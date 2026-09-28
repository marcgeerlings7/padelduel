/**
 * Pure formatteringshelpers voor de UI (geen React) — ook in unit tests en
 * server components bruikbaar.
 */

// Geen duizendtalscheiding: een rating "1.395" leest in NL als decimaal.
const ratingFormatter = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0, useGrouping: false });

/** 1395.4 → "1395" */
export function formatRating(value: number): string {
  return ratingFormatter.format(value);
}

/** +12 → "+12", −8 → "−8" (echt minteken), 0 → "±0". */
export function formatSignedDelta(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `−${Math.abs(rounded)}`;
  return "±0";
}

/** Initialen: eerste letter van de eerste twee woorden ("Smash Sisters" → "SS"). */
export function duoInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
