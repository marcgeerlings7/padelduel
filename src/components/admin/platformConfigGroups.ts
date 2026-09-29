/**
 * Presentatie van platform_config op de beheerpagina: leesbare namen,
 * eenheden en een logische groepering. Alleen weergave — de waarden zelf
 * komen altijd uit de database. Onbekende sleutels vallen in "Overig".
 */

export type ConfigEntry = { key: string; value: string; description: string | null };

export type ConfigGroupId = "ladder" | "duos" | "challenges" | "notifications" | "security" | "other";

type KeyMeta = { group: ConfigGroupId; label: string };

export const CONFIG_GROUPS: { id: ConfigGroupId; title: string; description: string }[] = [
  { id: "ladder", title: "Ladder en rating", description: "Rating, tiers, ELO en vaste penalty's. Forfeits lopen nooit via de ELO-formule." },
  { id: "challenges", title: "Challenges en wedstrijden", description: "Deadlines, bevestiging en disputes." },
  { id: "notifications", title: "Herinneringen", description: "Wanneer spelers een e-mailherinnering krijgen." },
  { id: "duos", title: "Duo's", description: "Lidmaatschap en ontbinding." },
  { id: "security", title: "Beveiliging en API", description: "Inlogbescherming en limieten voor de externe API." },
  { id: "other", title: "Overig", description: "Parameters zonder vaste groep." },
];

const KEYS: Record<string, KeyMeta> = {
  rating_tier_size: { group: "ladder", label: "Tier-breedte" },
  default_start_rating: { group: "ladder", label: "Startrating" },
  elo_margin_multiplier_max: { group: "ladder", label: "Gamesaldo-multiplier (max)" },
  elo_margin_multiplier_min: { group: "ladder", label: "Gamesaldo-multiplier (min)" },
  inactive_after_days: { group: "ladder", label: "Inactief na" },
  forfeit_rating_penalty: { group: "ladder", label: "Forfeit-penalty" },
  forfeit_cooldown_days: { group: "ladder", label: "Cooldown na forfeit" },
  challenge_response_deadline_days: { group: "challenges", label: "Reactietermijn challenge" },
  challenge_match_deadline_days: { group: "challenges", label: "Speeltermijn na acceptatie" },
  match_auto_confirm_hours: { group: "challenges", label: "Automatisch bevestigen van score" },
  forfeit_dispute_window_days: { group: "challenges", label: "Termijn forfeit-dispute" },
  repeated_opponent_window_days: { group: "challenges", label: "Venster herhaalde tegenstander" },
  postponement_max_days: { group: "challenges", label: "Maximaal uitstel" },
  postponement_max_per_challenge: { group: "challenges", label: "Uitstelverzoeken per challenge" },
  notification_auto_confirm_lead_hours: { group: "notifications", label: "Herinnering vóór automatisch bevestigen" },
  notification_match_deadline_lead_hours: { group: "notifications", label: "Herinnering vóór speeldeadline" },
  notification_response_deadline_lead_hours: { group: "notifications", label: "Herinnering vóór reactietermijn" },
  max_active_duos_per_user: { group: "duos", label: "Maximum actieve duo's per speler" },
  duo_dissolution_cooldown_days: { group: "duos", label: "Cooldown na ontbinding" },
  login_max_attempts: { group: "security", label: "Maximum mislukte inlogpogingen" },
  login_lockout_minutes: { group: "security", label: "Blokkeerduur na te veel pogingen" },
  availability_api_rate_limit_per_minute: { group: "security", label: "API-limiet" },
};

/** Eenheid afgeleid uit de sleutelnaam (bijv. `_days` → "dagen"). */
export function unitFor(key: string, value: string): string | null {
  const one = value.trim() === "1";
  if (key.endsWith("_per_minute")) return "per minuut";
  if (key.endsWith("_days")) return one ? "dag" : "dagen";
  if (key.endsWith("_hours")) return "uur";
  if (key.endsWith("_minutes")) return one ? "minuut" : "minuten";
  if (key === "rating_tier_size" || key === "default_start_rating" || key.endsWith("_penalty")) return "punten";
  if (key.includes("_multiplier")) return "×";
  return null;
}

export function labelFor(key: string): string {
  return KEYS[key]?.label ?? key;
}

export function groupConfig(entries: readonly ConfigEntry[]): { id: ConfigGroupId; title: string; description: string; entries: ConfigEntry[] }[] {
  return CONFIG_GROUPS.map((group) => ({
    ...group,
    entries: entries.filter((e) => (KEYS[e.key]?.group ?? "other") === group.id),
  })).filter((group) => group.entries.length > 0);
}
