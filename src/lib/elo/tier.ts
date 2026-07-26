/**
 * ELO_Algoritme.md §8bis. Afgeleide waarde, analoog aan de
 * ladderpositie (FR-3.3/FR-4.2) — nooit een opgeslagen kolom.
 */
export function getTier(rating: number, tierSize: number): number {
  return Math.floor(rating / tierSize);
}
