/**
 * E-mailnotificaties (KNLTB-aanvullingen, akkoord PO 2026-09-28).
 *
 * Principes:
 * - Event-mails (nieuwe uitdaging, score ingediend, geschil afgehandeld,
 *   uitstel gevraagd/beantwoord) worden pas NA de commit van de
 *   hoofdactie verstuurd, via `notifySafely`: een fout (DB, provider) wordt
 *   gelogd en breekt de hoofdactie nooit.
 * - Deadline-herinneringen draaien in de uurlijkse /api/jobs/run-all.
 * - Idempotent: vóór verzending wordt een rij in notification_log geclaimd
 *   (unique op user + soort + entiteit + occurrence_key). Bestaat die al,
 *   dan wordt er niets verstuurd. Mislukt de verzending, dan wordt de claim
 *   weer vrijgegeven zodat een volgende jobrun het opnieuw probeert.
 * - Elke ontvanger krijgt een eigen mail (nooit een gedeelde to/cc met
 *   andere adressen) en alleen als zijn/haar voorkeur voor die soort aan
 *   staat. Alleen actieve leden (left_at IS NULL) van geactiveerde
 *   accounts van het betrokken duo ontvangen iets.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/auth/email";
import { publicDisplayName } from "@/lib/profile/displayName";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_KEYS,
  PREFERENCE_FOR_KIND,
  type NotificationKind,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
} from "@/lib/notifications/preferences";
import {
  buildNotificationEmail,
  formatScoreRaw,
  type MatchResultLabel,
  type NotificationContent,
} from "@/lib/notifications/templates";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

const HOUR_MS = 60 * 60 * 1000;

type Recipient = { id: string; email: string; displayName: string | null };

export type DeliveryStats = {
  sent: number;
  skippedPreference: number;
  skippedDuplicate: number;
  failed: number;
};

function emptyStats(): DeliveryStats {
  return { sent: 0, skippedPreference: 0, skippedDuplicate: 0, failed: 0 };
}

function addStats(a: DeliveryStats, b: DeliveryStats): DeliveryStats {
  return {
    sent: a.sent + b.sent,
    skippedPreference: a.skippedPreference + b.skippedPreference,
    skippedDuplicate: a.skippedDuplicate + b.skippedDuplicate,
    failed: a.failed + b.failed,
  };
}

/**
 * Voert een notificatie-actie uit zonder dat een fout de aanroeper raakt.
 * Bedoeld voor event-mails ná een geslaagde (gecommitte) hoofdactie.
 */
export async function notifySafely(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[notificatie] ${label} mislukt:`, err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Voorkeuren
// ---------------------------------------------------------------------------

function toPreferences(row: Partial<NotificationPreferences> | null): NotificationPreferences {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const result = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const value = row[key];
    if (typeof value === "boolean") result[key] = value;
  }
  return result;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  return toPreferences(row);
}

export async function updateNotificationPreferences(
  userId: string,
  patch: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const data: Partial<NotificationPreferences> = {};
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const value = patch[key];
    if (typeof value === "boolean") data[key] = value;
  }
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return toPreferences(row);
}

async function loadPreferences(userIds: string[]): Promise<Map<string, NotificationPreferences>> {
  const rows = await prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } });
  const map = new Map<string, NotificationPreferences>();
  for (const row of rows) map.set(row.userId, toPreferences(row));
  return map;
}

// ---------------------------------------------------------------------------
// Verzending
// ---------------------------------------------------------------------------

async function getActiveDuoMembers(duoId: string): Promise<Recipient[]> {
  const memberships = await prisma.duoMembership.findMany({
    where: { duoId, leftAt: null, user: { isActive: true } },
    select: { user: { select: { id: true, email: true, displayName: true } } },
  });
  return memberships.map((m) => m.user);
}

/**
 * Stuurt één soort notificatie naar de gegeven ontvangers, elk apart,
 * met voorkeur-check en idempotente claim in notification_log.
 */
export async function deliverNotification(params: {
  recipients: Recipient[];
  kind: NotificationKind;
  entityId: string;
  occurrenceKey?: string;
  content: NotificationContent;
}): Promise<DeliveryStats> {
  const { kind, entityId, content } = params;
  const occurrenceKey = params.occurrenceKey ?? "";
  const stats = emptyStats();

  const unique = new Map<string, Recipient>();
  for (const r of params.recipients) unique.set(r.id, r);
  const recipients = [...unique.values()];
  if (recipients.length === 0) return stats;

  const preferences = await loadPreferences(recipients.map((r) => r.id));
  const preferenceKey = PREFERENCE_FOR_KIND[kind];

  for (const recipient of recipients) {
    const prefs = preferences.get(recipient.id) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    if (!prefs[preferenceKey]) {
      stats.skippedPreference++;
      continue;
    }

    const claimKey = { userId: recipient.id, type: kind, entityId, occurrenceKey };
    try {
      const claim = await prisma.notificationLog.createMany({ data: [claimKey], skipDuplicates: true });
      if (claim.count === 0) {
        stats.skippedDuplicate++;
        continue;
      }

      const message = buildNotificationEmail(recipient.email, publicDisplayName(recipient), content);
      const result = await sendEmail(message);
      if (result.ok) {
        stats.sent++;
      } else {
        stats.failed++;
        // Claim vrijgeven: een volgende (job)run mag het opnieuw proberen.
        await prisma.notificationLog.deleteMany({ where: claimKey });
      }
    } catch (err) {
      stats.failed++;
      // eslint-disable-next-line no-console
      console.error(
        `[notificatie] ${kind} voor entiteit ${entityId} mislukt:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return stats;
}

type ChallengeWithDuos = {
  id: string;
  challengerDuoId: string;
  challengedDuoId: string;
  challengerDuo: { id: string; name: string };
  challengedDuo: { id: string; name: string };
};

const DUO_NAME_SELECT = { select: { id: true, name: true } } as const;

async function submitterSide(
  submittedBy: string,
  challenge: { challengerDuoId: string },
): Promise<"challenger" | "challenged"> {
  // Zelfde afleiding als matchService.respondToMatch.
  const membership = await prisma.duoMembership.findFirst({
    where: { duoId: challenge.challengerDuoId, userId: submittedBy, leftAt: null },
  });
  return membership ? "challenger" : "challenged";
}

function resultLabel(resultType: string): MatchResultLabel {
  if (resultType === "WALKOVER") return "walkover";
  if (resultType === "RETIRED") return "retired";
  return "played";
}

function scoreText(challenge: ChallengeWithDuos, scoreRaw: string): string {
  return `${challenge.challengerDuo.name} – ${challenge.challengedDuo.name}: ${formatScoreRaw(scoreRaw)}`;
}

// ---------------------------------------------------------------------------
// Event-notificaties (aanroepen ná commit, via notifySafely)
// ---------------------------------------------------------------------------

export async function notifyChallengeReceived(challengeId: string): Promise<DeliveryStats> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT },
  });
  if (!challenge || challenge.status !== "PENDING") return emptyStats();

  return deliverNotification({
    recipients: await getActiveDuoMembers(challenge.challengedDuoId),
    kind: "CHALLENGE_RECEIVED",
    entityId: challenge.id,
    content: {
      kind: "CHALLENGE_RECEIVED",
      challengerDuoName: challenge.challengerDuo.name,
      challengedDuoName: challenge.challengedDuo.name,
      responseDeadline: challenge.responseDeadline,
    },
  });
}

async function notifyMatchAwaitingConfirmation(
  matchId: string,
  kind: "SCORE_SUBMITTED" | "AUTO_CONFIRM_REMINDER",
): Promise<DeliveryStats> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { challenge: { include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT } } },
  });
  if (!match || match.status !== "AWAITING_CONFIRMATION") return emptyStats();

  const challenge = match.challenge;
  const side = await submitterSide(match.submittedBy, challenge);
  const confirmingDuo = side === "challenger" ? challenge.challengedDuo : challenge.challengerDuo;
  const submittingDuo = side === "challenger" ? challenge.challengerDuo : challenge.challengedDuo;

  return deliverNotification({
    recipients: await getActiveDuoMembers(confirmingDuo.id),
    kind,
    entityId: match.id,
    content: {
      kind,
      ownDuoName: confirmingDuo.name,
      opponentDuoName: submittingDuo.name,
      scoreText: scoreText(challenge, match.scoreRaw),
      resultType: resultLabel(match.resultType),
      autoConfirmDeadline: match.autoConfirmDeadline,
    },
  });
}

export async function notifyScoreSubmitted(matchId: string): Promise<DeliveryStats> {
  return notifyMatchAwaitingConfirmation(matchId, "SCORE_SUBMITTED");
}

export async function notifyDisputeResolved(disputeId: string): Promise<DeliveryStats> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      match: {
        include: { challenge: { include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT } } },
      },
      challenge: { include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT } },
    },
  });
  if (!dispute || dispute.status === "OPEN") return emptyStats();

  const challenge = dispute.match?.challenge ?? dispute.challenge;
  if (!challenge) return emptyStats();

  const subject = dispute.subject === "MATCH_SCORE" ? "match_score" : "forfeit";
  const resolution = dispute.status === "RESOLVED_UPHELD" ? "upheld" : "overturned";
  const newMatchDeadline =
    subject === "match_score" && resolution === "overturned" ? challenge.matchDeadline : null;

  let stats = emptyStats();
  for (const [own, opponent] of [
    [challenge.challengerDuo, challenge.challengedDuo],
    [challenge.challengedDuo, challenge.challengerDuo],
  ] as const) {
    stats = addStats(
      stats,
      await deliverNotification({
        recipients: await getActiveDuoMembers(own.id),
        kind: "DISPUTE_RESOLVED",
        entityId: dispute.id,
        content: {
          kind: "DISPUTE_RESOLVED",
          ownDuoName: own.name,
          opponentDuoName: opponent.name,
          subject,
          resolution,
          newMatchDeadline,
        },
      }),
    );
  }
  return stats;
}

export async function notifyPostponementRequested(postponementId: string): Promise<DeliveryStats> {
  const postponement = await prisma.challengePostponement.findUnique({
    where: { id: postponementId },
    include: { challenge: { include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT } } },
  });
  if (!postponement || postponement.status !== "PENDING" || !postponement.challenge.matchDeadline) {
    return emptyStats();
  }
  const challenge = postponement.challenge;
  const requesting =
    postponement.requestedByDuoId === challenge.challengerDuoId ? challenge.challengerDuo : challenge.challengedDuo;
  const other = requesting.id === challenge.challengerDuoId ? challenge.challengedDuo : challenge.challengerDuo;

  return deliverNotification({
    recipients: await getActiveDuoMembers(other.id),
    kind: "POSTPONEMENT_REQUESTED",
    entityId: postponement.id,
    content: {
      kind: "POSTPONEMENT_REQUESTED",
      ownDuoName: other.name,
      requestingDuoName: requesting.name,
      requestedDays: postponement.requestedDays,
      currentMatchDeadline: challenge.matchDeadline!,
      reason: postponement.reason,
    },
  });
}

export async function notifyPostponementAnswered(postponementId: string): Promise<DeliveryStats> {
  const postponement = await prisma.challengePostponement.findUnique({
    where: { id: postponementId },
    include: { challenge: { include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT } } },
  });
  if (!postponement || (postponement.status !== "ACCEPTED" && postponement.status !== "DECLINED")) {
    return emptyStats();
  }
  const challenge = postponement.challenge;
  const requesting =
    postponement.requestedByDuoId === challenge.challengerDuoId ? challenge.challengerDuo : challenge.challengedDuo;
  const responding = requesting.id === challenge.challengerDuoId ? challenge.challengedDuo : challenge.challengerDuo;

  return deliverNotification({
    recipients: await getActiveDuoMembers(requesting.id),
    kind: "POSTPONEMENT_ANSWERED",
    entityId: postponement.id,
    content: {
      kind: "POSTPONEMENT_ANSWERED",
      ownDuoName: requesting.name,
      respondingDuoName: responding.name,
      accepted: postponement.status === "ACCEPTED",
      newMatchDeadline: postponement.newMatchDeadline,
    },
  });
}

// ---------------------------------------------------------------------------
// Deadline-herinneringen (uurlijkse job)
// ---------------------------------------------------------------------------

export type ReminderRunResult = {
  challengeResponseReminders: DeliveryStats;
  matchDeadlineReminders: DeliveryStats;
  autoConfirmReminders: DeliveryStats;
};

/**
 * Idempotent: elke herinnering wordt per ontvanger hooguit één keer
 * verstuurd per (entiteit, deadline) — de deadline zit in de
 * occurrence_key, zodat na een verlenging (uitstel, overturned dispute)
 * wél een nieuwe herinnering voor de nieuwe deadline kan komen. Alleen
 * deadlines in de toekomst binnen de lead-tijd tellen: een gemiste run
 * leidt niet tot een herinnering voor een al verstreken deadline.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const [responseLeadHours, matchLeadHours, autoConfirmLeadHours] = await Promise.all([
    getConfigNumber("notification_response_deadline_lead_hours"),
    getConfigNumber("notification_match_deadline_lead_hours"),
    getConfigNumber("notification_auto_confirm_lead_hours"),
  ]);

  const result: ReminderRunResult = {
    challengeResponseReminders: emptyStats(),
    matchDeadlineReminders: emptyStats(),
    autoConfirmReminders: emptyStats(),
  };

  const pending = await prisma.challenge.findMany({
    where: {
      status: "PENDING",
      responseDeadline: { gt: now, lte: new Date(now.getTime() + responseLeadHours * HOUR_MS) },
    },
    include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT },
  });
  for (const challenge of pending) {
    result.challengeResponseReminders = addStats(
      result.challengeResponseReminders,
      await deliverNotification({
        recipients: await getActiveDuoMembers(challenge.challengedDuoId),
        kind: "CHALLENGE_RESPONSE_REMINDER",
        entityId: challenge.id,
        occurrenceKey: challenge.responseDeadline.toISOString(),
        content: {
          kind: "CHALLENGE_RESPONSE_REMINDER",
          challengerDuoName: challenge.challengerDuo.name,
          challengedDuoName: challenge.challengedDuo.name,
          responseDeadline: challenge.responseDeadline,
        },
      }),
    );
  }

  const unplayed = await prisma.challenge.findMany({
    where: {
      status: "ACCEPTED",
      matchDeadline: { gt: now, lte: new Date(now.getTime() + matchLeadHours * HOUR_MS) },
      matches: { none: { status: { not: "VOIDED" } } },
    },
    include: { challengerDuo: DUO_NAME_SELECT, challengedDuo: DUO_NAME_SELECT },
  });
  for (const challenge of unplayed) {
    const matchDeadline = challenge.matchDeadline!;
    for (const [own, opponent] of [
      [challenge.challengerDuo, challenge.challengedDuo],
      [challenge.challengedDuo, challenge.challengerDuo],
    ] as const) {
      result.matchDeadlineReminders = addStats(
        result.matchDeadlineReminders,
        await deliverNotification({
          recipients: await getActiveDuoMembers(own.id),
          kind: "MATCH_DEADLINE_REMINDER",
          entityId: challenge.id,
          occurrenceKey: matchDeadline.toISOString(),
          content: {
            kind: "MATCH_DEADLINE_REMINDER",
            ownDuoName: own.name,
            opponentDuoName: opponent.name,
            matchDeadline,
          },
        }),
      );
    }
  }

  const awaiting = await prisma.match.findMany({
    where: {
      status: "AWAITING_CONFIRMATION",
      autoConfirmDeadline: { gt: now, lte: new Date(now.getTime() + autoConfirmLeadHours * HOUR_MS) },
    },
    select: { id: true },
  });
  for (const { id } of awaiting) {
    result.autoConfirmReminders = addStats(
      result.autoConfirmReminders,
      await notifyMatchAwaitingConfirmation(id, "AUTO_CONFIRM_REMINDER"),
    );
  }

  return result;
}
