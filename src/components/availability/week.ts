/**
 * Pure helpers voor de weekweergave van beschikbaarheid (alleen presentatie;
 * validatie en API-calls zitten in useDuoAvailability / lib/availability).
 * Dagindex: 0 = maandag … 6 = zondag (zelfde als de API).
 */

export type TimeBlock = { dayOfWeek: number; startTime: string; endTime: string };

/** "HH:MM" → minuten sinds middernacht (ongeldig → 0). */
export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export type TrackRange = { startMinutes: number; endMinutes: number };

/**
 * Zichtbaar bereik van de tijdlijn: standaard 06:00–24:00, verbreed naar het
 * hele uur van het vroegste blok als er eerder begonnen wordt.
 */
export function trackRange(blocks: readonly TimeBlock[]): TrackRange {
  const defaultStart = 6 * 60;
  const earliest = blocks.reduce((min, b) => Math.min(min, toMinutes(b.startTime)), defaultStart);
  return { startMinutes: Math.floor(earliest / 60) * 60, endMinutes: 24 * 60 };
}

/** Positie van een blok op de tijdlijn als percentages (geklemd binnen het bereik). */
export function barPosition(block: TimeBlock, range: TrackRange): { left: number; width: number } {
  const span = range.endMinutes - range.startMinutes;
  if (span <= 0) return { left: 0, width: 0 };
  const start = Math.max(range.startMinutes, Math.min(range.endMinutes, toMinutes(block.startTime)));
  const end = Math.max(start, Math.min(range.endMinutes, toMinutes(block.endTime)));
  return {
    left: ((start - range.startMinutes) / span) * 100,
    width: ((end - start) / span) * 100,
  };
}

/** Blokken per dag (index 0–6), per dag gesorteerd op begintijd. */
export function groupByDay<T extends TimeBlock>(blocks: readonly T[]): T[][] {
  const days: T[][] = Array.from({ length: 7 }, () => []);
  for (const block of blocks) {
    if (block.dayOfWeek >= 0 && block.dayOfWeek <= 6) days[block.dayOfWeek]!.push(block);
  }
  for (const day of days) day.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return days;
}

/**
 * Totaal beschikbare minuten per week en het aantal dagen met beschikbaarheid.
 * Overlappende blokken op dezelfde dag worden samengevoegd (niet dubbel geteld).
 */
export function weekSummary(blocks: readonly TimeBlock[]): { totalMinutes: number; days: number } {
  let totalMinutes = 0;
  let days = 0;
  for (const day of groupByDay(blocks)) {
    if (day.length === 0) continue;
    days += 1;
    let curStart = -1;
    let curEnd = -1;
    for (const b of day) {
      const s = toMinutes(b.startTime);
      const e = toMinutes(b.endTime);
      if (e <= s) continue;
      if (s > curEnd) {
        if (curEnd > curStart) totalMinutes += curEnd - curStart;
        curStart = s;
        curEnd = e;
      } else {
        curEnd = Math.max(curEnd, e);
      }
    }
    if (curEnd > curStart) totalMinutes += curEnd - curStart;
  }
  return { totalMinutes, days };
}

/** 570 → "9 uur 30 min", 60 → "1 uur", 45 → "45 min", 0 → "0 uur". */
export function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (m === 0) return `${h} uur`;
  if (h === 0) return `${m} min`;
  return `${h} uur ${m} min`;
}

/** Dagindex (0 = maandag) van een datum. */
export function mondayBasedDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}
