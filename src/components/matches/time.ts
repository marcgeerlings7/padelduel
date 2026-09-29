/**
 * Pure datum/deadline-helpers voor challenges en wedstrijden (geen React).
 * Relatieve tijd in het Nederlands ("over 2 dagen", "morgen", "3 uur geleden")
 * plus een urgentieniveau voor de styling van deadlines.
 */

export type Urgency = "normal" | "soon" | "urgent" | "overdue";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relativeFormatter = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

/** "over 2 dagen" / "morgen" / "over 5 uur" / "3 dagen geleden". */
export function formatRelative(target: Date | string, now: Date = new Date()): string {
  const diff = new Date(target).getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < HOUR) {
    return relativeFormatter.format(Math.round(diff / MINUTE), "minute");
  }
  if (abs < 36 * HOUR) {
    return relativeFormatter.format(Math.round(diff / HOUR), "hour");
  }
  return relativeFormatter.format(Math.round(diff / DAY), "day");
}

/**
 * Urgentie van een deadline: verlopen (< nu), urgent (< 24 uur),
 * binnenkort (< 3 dagen), anders normaal.
 */
export function deadlineUrgency(deadline: Date | string, now: Date = new Date()): Urgency {
  const diff = new Date(deadline).getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff < DAY) return "urgent";
  if (diff < 3 * DAY) return "soon";
  return "normal";
}

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

/** "di 30 sep, 20:00" — voor tooltips/title bij een relatieve deadline. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

/** "28 sep 2026". */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/** "28 sep" in het huidige jaar, anders "28 sep 2025". */
export function formatShortDate(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() ? shortDateFormatter.format(date) : dateFormatter.format(date);
}
