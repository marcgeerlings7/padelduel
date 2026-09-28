import { Reliability } from "./types";

/**
 * Betrouwbaarheid: "X/Y challenges gespeeld".
 *
 * - X (`played`): challenges van dit duo (als uitdager óf uitgedaagde) met
 *   status `completed`, d.w.z. geëindigd in een bevestigde match.
 * - Y (`total`): X plus de forfeits die aan DIT duo toe te rekenen zijn:
 *   - `unplayed_timeout` (geaccepteerd, niet gespeeld): telt voor beide
 *     duo's, tenzij een forfeit-dispute `resolved_overturned` de schuld bij
 *     de ANDERE partij legde — herkenbaar aan het correctie-record
 *     (is_forfeit, rating_after > rating_before) bij dit duo;
 *   - `expired` (niet gereageerd): telt alleen voor de uitgedaagde.
 * - Telt NIET mee: `declined` (weigeren is een legitieme keuze), lopende
 *   challenges (`pending`/`accepted`) en `expired` voor de uitdager.
 *
 * Invoer zijn de al (in SQL) getelde aantallen, zie statsService.
 */
export function computeReliability(played: number, attributableForfeits: number): Reliability {
  if (!Number.isInteger(played) || !Number.isInteger(attributableForfeits) || played < 0 || attributableForfeits < 0) {
    throw new RangeError(`Ongeldige tellingen: played=${played}, forfeits=${attributableForfeits}`);
  }
  const total = played + attributableForfeits;
  return {
    played,
    total,
    percentage: total === 0 ? null : Math.round((played / total) * 100),
  };
}
