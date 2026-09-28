import { z } from "zod";

/**
 * Per-user opt-out per soort e-mailnotificatie (KNLTB-aanvullingen,
 * akkoord PO 2026-09-28). Alles staat standaard AAN; een gebruiker zonder
 * rij in notification_preference krijgt DEFAULT_NOTIFICATION_PREFERENCES.
 */
export const NOTIFICATION_PREFERENCE_KEYS = [
  "challengeReceived",
  "challengeResponseReminder",
  "matchDeadlineReminder",
  "scoreConfirmation",
  "disputeResolved",
  "postponement",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  challengeReceived: true,
  challengeResponseReminder: true,
  matchDeadlineReminder: true,
  scoreConfirmation: true,
  disputeResolved: true,
  postponement: true,
};

/** Nederlandse labels, zodat de UI ze niet zelf hoeft te verzinnen. */
export const NOTIFICATION_PREFERENCE_LABELS: Record<NotificationPreferenceKey, string> = {
  challengeReceived: "Nieuwe uitdaging ontvangen",
  challengeResponseReminder: "Herinnering: reactietermijn van een uitdaging loopt af",
  matchDeadlineReminder: "Herinnering: speeltermijn loopt af",
  scoreConfirmation: "Score wacht op jouw bevestiging (en herinnering vóór automatische bevestiging)",
  disputeResolved: "Geschil afgehandeld door een admin",
  postponement: "Uitstelverzoeken en antwoorden daarop",
};

/** Notificatiesoorten (= enum notification_type in de database). */
export type NotificationKind =
  | "CHALLENGE_RECEIVED"
  | "CHALLENGE_RESPONSE_REMINDER"
  | "MATCH_DEADLINE_REMINDER"
  | "SCORE_SUBMITTED"
  | "AUTO_CONFIRM_REMINDER"
  | "DISPUTE_RESOLVED"
  | "POSTPONEMENT_REQUESTED"
  | "POSTPONEMENT_ANSWERED";

/** Welke voorkeur-toggle bepaalt of een soort verstuurd wordt. */
export const PREFERENCE_FOR_KIND: Record<NotificationKind, NotificationPreferenceKey> = {
  CHALLENGE_RECEIVED: "challengeReceived",
  CHALLENGE_RESPONSE_REMINDER: "challengeResponseReminder",
  MATCH_DEADLINE_REMINDER: "matchDeadlineReminder",
  SCORE_SUBMITTED: "scoreConfirmation",
  AUTO_CONFIRM_REMINDER: "scoreConfirmation",
  DISPUTE_RESOLVED: "disputeResolved",
  POSTPONEMENT_REQUESTED: "postponement",
  POSTPONEMENT_ANSWERED: "postponement",
};

export const updateNotificationPreferencesSchema = z
  .object({
    challengeReceived: z.boolean().optional(),
    challengeResponseReminder: z.boolean().optional(),
    matchDeadlineReminder: z.boolean().optional(),
    scoreConfirmation: z.boolean().optional(),
    disputeResolved: z.boolean().optional(),
    postponement: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Geef minimaal één voorkeur op om te wijzigen.",
  });

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
