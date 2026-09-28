/**
 * Publieke naam van een speler zoals andere gebruikers (en e-mails) die
 * zien. Nooit het e-mailadres: bestaande accounts zonder weergavenaam
 * krijgen een neutrale, niet-persoonlijke fallback op basis van een stukje
 * van het (willekeurige) user-id, zodat twee naamloze spelers toch uit
 * elkaar te houden zijn.
 */
export function publicDisplayName(user: { id: string; displayName: string | null }): string {
  const name = user.displayName?.trim();
  if (name) return name;
  const suffix = user.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `Speler ${suffix}`;
}
