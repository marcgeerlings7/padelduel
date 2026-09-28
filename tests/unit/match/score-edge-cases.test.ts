import { describe, it, expect } from "vitest";
import {
  parseScore,
  validateSets,
  determineWinner,
  serializeScore,
  InvalidScoreError,
  type SetScore,
} from "@/lib/match/score";

const withSecondSet = (set: SetScore): SetScore[] => [
  set,
  { challengerGames: 6, challengedGames: 3 },
];

describe("validateSets — geldige eindstanden per set", () => {
  it.each([
    [6, 0],
    [6, 4],
    [7, 5],
    [7, 6],
    [4, 6],
    [6, 7],
  ])("accepteert %i-%i", (a, b) => {
    // Na een verloren eerste set is een derde set nodig voor een winnaar.
    const sets = withSecondSet({ challengerGames: a, challengedGames: b });
    if (a < b) sets.push({ challengerGames: 6, challengedGames: 2 });
    expect(() => validateSets(sets)).not.toThrow();
  });

  it.each([
    [8, 6],
    [6, 5],
    [5, 3],
    [7, 4],
    [7, 0],
  ])("weigert %i-%i", (a, b) => {
    expect(() => validateSets(withSecondSet({ challengerGames: a, challengedGames: b }))).toThrow(
      InvalidScoreError,
    );
  });
});

describe("validateSets — super-tiebreak", () => {
  const decided = (tb: SetScore): SetScore[] => [
    { challengerGames: 6, challengedGames: 4 },
    { challengerGames: 3, challengedGames: 6 },
    tb,
  ];

  it("weigert een tiebreak met minder dan 2 punten verschil", () => {
    expect(() => validateSets(decided({ challengerGames: 10, challengedGames: 9 }))).toThrow(
      InvalidScoreError,
    );
  });

  it("weigert een tiebreak boven de 10 met meer dan 2 verschil", () => {
    expect(() => validateSets(decided({ challengerGames: 13, challengedGames: 10 }))).toThrow(
      InvalidScoreError,
    );
  });

  it("accepteert 10-8 en 12-10", () => {
    const sets = decided({ challengerGames: 10, challengedGames: 8 });
    expect(() => validateSets(sets)).not.toThrow();
    expect(determineWinner(sets)).toBe("challenger");
    expect(() => validateSets(decided({ challengerGames: 12, challengedGames: 10 }))).not.toThrow();
  });
});

describe("serializeScore / parseScore", () => {
  it("behoudt de score door serialisatie heen", () => {
    const original: SetScore[] = [
      { challengerGames: 6, challengedGames: 4 },
      { challengerGames: 7, challengedGames: 5 },
    ];
    expect(parseScore(serializeScore(original))).toEqual(original);
  });
});
