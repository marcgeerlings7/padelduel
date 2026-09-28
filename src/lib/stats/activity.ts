/**
 * Inactief-markering. Default voor platform_config.inactive_after_days
 * (rij nog toe te voegen in een migratie, zie Technical_Debt.md
 * "KNLTB-aanvullingen"); de service leest de key met deze fallback.
 */
export const INACTIVE_AFTER_DAYS_KEY = "inactive_after_days";
export const DEFAULT_INACTIVE_AFTER_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityInput = {
  /** Aanmaakmoment van het duo: een nieuw duo is nooit direct "inactief". */
  duoCreatedAt: Date;
  lastConfirmedMatchAt: Date | null;
  /** Laatste challenge die dit duo zelf verstuurde. */
  lastChallengeSentAt: Date | null;
  /** Laatste challenge die dit duo als uitgedaagde accepteerde. */
  lastChallengeAcceptedAt: Date | null;
};

/**
 * Laatste activiteit = de meest recente van: duo aangemaakt, bevestigde
 * match, zelf verstuurde challenge, geaccepteerde challenge. Passieve
 * gebeurtenissen (uitgedaagd worden, een forfeit-penalty krijgen) tellen
 * bewust NIET — anders houdt een duo dat nooit reageert zichzelf "actief".
 */
export function lastActivityAt(input: ActivityInput): Date {
  let latest = input.duoCreatedAt;
  for (const d of [input.lastConfirmedMatchAt, input.lastChallengeSentAt, input.lastChallengeAcceptedAt]) {
    if (d && d > latest) latest = d;
  }
  return latest;
}

/** Inactief als de laatste activiteit strikt langer dan `inactiveAfterDays` geleden is. */
export function isInactive(lastActivity: Date, now: Date, inactiveAfterDays: number): boolean {
  if (!Number.isFinite(inactiveAfterDays) || inactiveAfterDays < 0) {
    throw new RangeError(`inactive_after_days moet >= 0 zijn (is ${inactiveAfterDays})`);
  }
  return now.getTime() - lastActivity.getTime() > inactiveAfterDays * DAY_MS;
}
