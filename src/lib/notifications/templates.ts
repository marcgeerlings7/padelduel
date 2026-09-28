/**
 * E-mailtemplates voor notificaties (KNLTB-aanvullingen, akkoord PO
 * 2026-09-28). Pure functies: tekst + eenvoudige HTML, Nederlands, met een
 * link naar de app (APP_BASE_URL) en een afmeldhint naar /profile.
 *
 * Privacy: templates bevatten alleen duo-namen en de weergavenaam van de
 * ONTVANGER zelf — nooit e-mailadressen of namen van andere spelers.
 * Alle variabele tekst (duo-namen en redenen zijn gebruikersinvoer) wordt
 * in de HTML ge-escaped.
 */
import type { EmailMessage } from "@/lib/auth/email";

export type MatchResultLabel = "played" | "walkover" | "retired";

/** `kind` komt overeen met NotificationKind (preferences.ts). */
export type NotificationContent =
  | {
      kind: "CHALLENGE_RECEIVED" | "CHALLENGE_RESPONSE_REMINDER";
      challengerDuoName: string;
      challengedDuoName: string;
      responseDeadline: Date;
    }
  | {
      kind: "MATCH_DEADLINE_REMINDER";
      ownDuoName: string;
      opponentDuoName: string;
      matchDeadline: Date;
    }
  | {
      kind: "SCORE_SUBMITTED" | "AUTO_CONFIRM_REMINDER";
      ownDuoName: string;
      opponentDuoName: string;
      /** Bijv. "Net Ninjas – Smash Sisters: 6-4 6-3". */
      scoreText: string;
      resultType: MatchResultLabel;
      autoConfirmDeadline: Date;
    }
  | {
      kind: "DISPUTE_RESOLVED";
      ownDuoName: string;
      opponentDuoName: string;
      subject: "match_score" | "forfeit";
      resolution: "upheld" | "overturned";
      /** Alleen bij overturned match-score: de nieuwe speeltermijn. */
      newMatchDeadline: Date | null;
    }
  | {
      kind: "POSTPONEMENT_REQUESTED";
      ownDuoName: string;
      requestingDuoName: string;
      requestedDays: number;
      currentMatchDeadline: Date;
      reason: string | null;
    }
  | {
      kind: "POSTPONEMENT_ANSWERED";
      ownDuoName: string;
      respondingDuoName: string;
      accepted: boolean;
      newMatchDeadline: Date | null;
    };

const DATE_FORMAT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});

export function formatDateTimeNl(date: Date): string {
  return DATE_FORMAT.format(date);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "6-4,3-6,10-8" -> "6-4 3-6 10-8". */
export function formatScoreRaw(scoreRaw: string): string {
  return scoreRaw.split(",").map((s) => s.trim()).join(" ");
}

export function resolveAppBaseUrl(): string {
  const base = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

type Rendered = { subject: string; paragraphs: string[]; ctaLabel: string; ctaPath: string };

const RESULT_TYPE_SUFFIX: Record<MatchResultLabel, string> = {
  played: "",
  walkover: " (walkover)",
  retired: " (opgave)",
};

function render(content: NotificationContent): Rendered {
  switch (content.kind) {
    case "CHALLENGE_RECEIVED":
      return {
        subject: `Nieuwe uitdaging voor ${content.challengedDuoName}`,
        paragraphs: [
          `${content.challengerDuoName} heeft jullie duo ${content.challengedDuoName} uitgedaagd.`,
          `Reageer vóór ${formatDateTimeNl(content.responseDeadline)}. Zonder reactie vervalt de uitdaging en krijgt jullie duo een vaste forfeit-penalty.`,
        ],
        ctaLabel: "Bekijk de uitdaging",
        ctaPath: "/challenges",
      };
    case "CHALLENGE_RESPONSE_REMINDER":
      return {
        subject: `Herinnering: reageer op de uitdaging van ${content.challengerDuoName}`,
        paragraphs: [
          `Jullie duo ${content.challengedDuoName} heeft nog niet gereageerd op de uitdaging van ${content.challengerDuoName}.`,
          `De reactietermijn loopt af op ${formatDateTimeNl(content.responseDeadline)}. Daarna vervalt de uitdaging en volgt een vaste forfeit-penalty.`,
        ],
        ctaLabel: "Accepteren of weigeren",
        ctaPath: "/challenges",
      };
    case "MATCH_DEADLINE_REMINDER":
      return {
        subject: `Herinnering: speel jullie wedstrijd tegen ${content.opponentDuoName}`,
        paragraphs: [
          `Er is nog geen score ingediend voor de wedstrijd van ${content.ownDuoName} tegen ${content.opponentDuoName}.`,
          `De speeltermijn loopt af op ${formatDateTimeNl(content.matchDeadline)}. Is er dan geen score, dan krijgen beide duo's een vaste forfeit-penalty. Lukt het niet op tijd? Vraag in overleg uitstel aan.`,
        ],
        ctaLabel: "Score indienen of uitstel vragen",
        ctaPath: "/challenges",
      };
    case "SCORE_SUBMITTED":
      return {
        subject: `Bevestig de score tegen ${content.opponentDuoName}`,
        paragraphs: [
          `${content.opponentDuoName} heeft een uitslag ingediend${RESULT_TYPE_SUFFIX[content.resultType]}: ${content.scoreText}.`,
          `Klopt dit? Bevestig de score. Klopt het niet, betwist hem dan. Zonder reactie wordt de score op ${formatDateTimeNl(content.autoConfirmDeadline)} automatisch bevestigd.`,
        ],
        ctaLabel: "Bevestigen of betwisten",
        ctaPath: "/challenges",
      };
    case "AUTO_CONFIRM_REMINDER":
      return {
        subject: `Herinnering: score tegen ${content.opponentDuoName} wordt binnenkort definitief`,
        paragraphs: [
          `De uitslag${RESULT_TYPE_SUFFIX[content.resultType]} ${content.scoreText} wacht nog op bevestiging door jullie duo ${content.ownDuoName}.`,
          `Op ${formatDateTimeNl(content.autoConfirmDeadline)} wordt de score automatisch bevestigd en verwerkt in de rating. Klopt hij niet? Betwist hem vóór dat moment.`,
        ],
        ctaLabel: "Bevestigen of betwisten",
        ctaPath: "/challenges",
      };
    case "DISPUTE_RESOLVED": {
      let outcome: string;
      if (content.subject === "match_score") {
        outcome =
          content.resolution === "upheld"
            ? "De admin heeft de ingediende score gehandhaafd; de uitslag is verwerkt in de rating."
            : `De admin heeft de ingediende score ongeldig verklaard. Jullie kunnen opnieuw spelen en een nieuwe score indienen${
                content.newMatchDeadline ? ` vóór ${formatDateTimeNl(content.newMatchDeadline)}` : ""
              }.`;
      } else {
        outcome =
          content.resolution === "upheld"
            ? "De admin heeft de forfeit-penalty voor beide duo's gehandhaafd."
            : "De admin heeft de schuld aan één duo toegewezen; bij het andere duo is de penalty teruggedraaid.";
      }
      return {
        subject: `Geschil afgehandeld: ${content.ownDuoName} – ${content.opponentDuoName}`,
        paragraphs: [
          `Het geschil over de wedstrijd tussen ${content.ownDuoName} en ${content.opponentDuoName} is afgehandeld.`,
          outcome,
        ],
        ctaLabel: "Bekijk de details",
        ctaPath: "/challenges",
      };
    }
    case "POSTPONEMENT_REQUESTED":
      return {
        subject: `${content.requestingDuoName} vraagt uitstel van jullie wedstrijd`,
        paragraphs: [
          `${content.requestingDuoName} vraagt ${content.requestedDays} dag(en) uitstel voor de wedstrijd tegen jullie duo ${content.ownDuoName}. De huidige speeltermijn loopt af op ${formatDateTimeNl(content.currentMatchDeadline)}.`,
          ...(content.reason ? [`Toelichting: "${content.reason}"`] : []),
          "Uitstel geldt alleen als jullie ermee akkoord gaan. Reageer vóór de huidige speeltermijn afloopt.",
        ],
        ctaLabel: "Uitstel accepteren of weigeren",
        ctaPath: "/challenges",
      };
    case "POSTPONEMENT_ANSWERED":
      return {
        subject: content.accepted
          ? `${content.respondingDuoName} gaat akkoord met uitstel`
          : `${content.respondingDuoName} heeft het uitstel geweigerd`,
        paragraphs: content.accepted
          ? [
              `${content.respondingDuoName} is akkoord met het uitstelverzoek van jullie duo ${content.ownDuoName}.`,
              content.newMatchDeadline
                ? `De nieuwe speeltermijn loopt af op ${formatDateTimeNl(content.newMatchDeadline)}.`
                : "De speeltermijn is verlengd.",
            ]
          : [
              `${content.respondingDuoName} heeft het uitstelverzoek van jullie duo ${content.ownDuoName} geweigerd.`,
              "De oorspronkelijke speeltermijn blijft gelden.",
            ],
        ctaLabel: "Bekijk de uitdaging",
        ctaPath: "/challenges",
      };
  }
}

export function buildNotificationEmail(
  to: string,
  recipientName: string,
  content: NotificationContent,
  baseUrl: string = resolveAppBaseUrl(),
): EmailMessage {
  const { subject, paragraphs, ctaLabel, ctaPath } = render(content);
  const ctaUrl = `${baseUrl}${ctaPath}`;
  const preferencesUrl = `${baseUrl}/profile`;
  const greeting = `Hoi ${recipientName},`;
  const footer =
    "Je ontvangt deze e-mail omdat je lid bent van een duo op Padel Ladder. " +
    `Wil je dit soort berichten niet meer ontvangen? Pas je meldingsvoorkeuren aan via ${preferencesUrl}`;

  const body = [greeting, "", ...paragraphs.flatMap((p) => [p, ""]), `${ctaLabel}: ${ctaUrl}`, "", "—", footer].join(
    "\n",
  );

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:560px">',
    `<p>${escapeHtml(greeting)}</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    `<p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(ctaLabel)}</a></p>`,
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">',
    `<p style="font-size:12px;color:#6b7280">Je ontvangt deze e-mail omdat je lid bent van een duo op Padel Ladder. Wil je dit soort berichten niet meer ontvangen? <a href="${escapeHtml(preferencesUrl)}" style="color:#6b7280">Pas je meldingsvoorkeuren aan</a>.</p>`,
    "</div>",
  ].join("\n");

  return { to, subject: `Padel Ladder — ${subject}`, body, html };
}
