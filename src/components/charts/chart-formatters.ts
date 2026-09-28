// Padel Ladder: locale nl-NL (was en-US); getallen zonder duizendtalscheiding
// (een rating "1.395" leest in NL als decimaal).
export const shortDateFmt = new Intl.DateTimeFormat("nl-NL", {
  month: "short",
  day: "numeric",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const hmsTimeFmt = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("nl-NL", { useGrouping: false }).format;
