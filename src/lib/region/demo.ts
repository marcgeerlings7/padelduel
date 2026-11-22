/**
 * Demoregio (demo-accounts op productie, verzoek PO 2026-11-22; zie migratie
 * 20261122140000_demo_accounts). Hij staat altijd achteraan in regiolijsten,
 * zodat bezoekers standaard een echte regio zien.
 */
export const DEMO_REGION_SLUG = "demo";

export function sortRegionsDemoLast<T extends { slug: string }>(regions: readonly T[]): T[] {
  const real = regions.filter((r) => r.slug !== DEMO_REGION_SLUG);
  const demo = regions.filter((r) => r.slug === DEMO_REGION_SLUG);
  return [...real, ...demo];
}

/**
 * Publieke demo-accounts (migratie 20261122140000_demo_accounts). Bewust
 * zichtbaar op de inlogpagina: gewone spelers zonder adminrechten, alleen
 * actief in de demoregio, zonder e-mailnotificaties.
 */
export const DEMO_PASSWORD = "PadelDemo2026!";

export const DEMO_ACCOUNTS: readonly { email: string; name: string }[] = [
  { email: "demo1@example.com", name: "Demo Sanne" },
  { email: "demo2@example.com", name: "Demo Joris" },
  { email: "demo3@example.com", name: "Demo Fleur" },
  { email: "demo4@example.com", name: "Demo Tim" },
  { email: "demo5@example.com", name: "Demo Noor" },
];
