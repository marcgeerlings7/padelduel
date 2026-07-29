/**
 * Score-formaat: `score_raw` (VARCHAR(50)) had in het schema nooit een
 * voorgeschreven encoding. Compact formaat gekozen: sets gescheiden door
 * komma's, elke set als "games-challenger-games-challenged", bijv.
 * "6-4,3-6,10-8" — past ruim binnen 50 tekens en is deterministisch te
 * parsen (i.t.t. JSON, dat bij 3 sets krapper zou passen).
 */

export type SetScore = { challengerGames: number; challengedGames: number };
export type MatchWinner = "challenger" | "challenged";

export class InvalidScoreError extends Error {}

export function serializeScore(sets: SetScore[]): string {
  return sets.map((s) => `${s.challengerGames}-${s.challengedGames}`).join(",");
}

export function parseScore(scoreRaw: string): SetScore[] {
  return scoreRaw.split(",").map((part) => {
    const match = /^(\d+)-(\d+)$/.exec(part.trim());
    if (!match) {
      throw new InvalidScoreError(`Ongeldig set-formaat: "${part}"`);
    }
    return { challengerGames: Number(match[1]), challengedGames: Number(match[2]) };
  });
}

/**
 * Valideert dat de sets een eenduidige winnaar opleveren: 2 of 3 sets,
 * geen gelijkspel per set, en de winnaar heeft strikt meer sets gewonnen.
 */
export function validateSets(sets: SetScore[]): void {
  if (sets.length < 2 || sets.length > 3) {
    throw new InvalidScoreError("Een wedstrijd bestaat uit 2 of 3 sets.");
  }
  for (const set of sets) {
    if (set.challengerGames === set.challengedGames) {
      throw new InvalidScoreError("Een set kan niet in een gelijkspel eindigen.");
    }
    if (set.challengerGames < 0 || set.challengedGames < 0) {
      throw new InvalidScoreError("Games per set kunnen niet negatief zijn.");
    }
  }
  const challengerSets = sets.filter((s) => s.challengerGames > s.challengedGames).length;
  const challengedSets = sets.length - challengerSets;
  if (challengerSets === challengedSets) {
    throw new InvalidScoreError("De sets leveren geen eenduidige winnaar op.");
  }
}

export function determineWinner(sets: SetScore[]): MatchWinner {
  const challengerSets = sets.filter((s) => s.challengerGames > s.challengedGames).length;
  const challengedSets = sets.length - challengerSets;
  return challengerSets > challengedSets ? "challenger" : "challenged";
}
