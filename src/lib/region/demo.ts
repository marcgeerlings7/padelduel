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
