import { Duo } from "./types";

/**
 * ELO_Algoritme.md §8bis. Vaste, configureerbare penalty — GEEN
 * ELO-formule. `penalty` komt van de aanroeper (platform_config.
 * forfeit_rating_penalty), deze module blijft DB-onafhankelijk.
 */
export function applyForfeitPenalty(duo: Duo, penalty: number): number {
  return Math.max(0, duo.currentRating - penalty);
}
