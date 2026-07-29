import { describe, it, expect } from "vitest";
import {
  serializeScore,
  parseScore,
  validateSets,
  determineWinner,
  InvalidScoreError,
} from "@/lib/match/score";

describe("serializeScore / parseScore", () => {
  it("serialiseert en parset symmetrisch", () => {
    const sets = [
      { challengerGames: 6, challengedGames: 4 },
      { challengerGames: 3, challengedGames: 6 },
      { challengerGames: 10, challengedGames: 8 },
    ];
    const raw = serializeScore(sets);
    expect(raw).toBe("6-4,3-6,10-8");
    expect(raw.length).toBeLessThanOrEqual(50);
    expect(parseScore(raw)).toEqual(sets);
  });

  it("weigert een ongeldig set-formaat", () => {
    expect(() => parseScore("6-4,onzin")).toThrow(InvalidScoreError);
  });
});

describe("validateSets", () => {
  it("accepteert 2 sets met een eenduidige winnaar", () => {
    expect(() =>
      validateSets([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 6, challengedGames: 3 },
      ]),
    ).not.toThrow();
  });

  it("accepteert 3 sets met een eenduidige winnaar", () => {
    expect(() =>
      validateSets([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 3, challengedGames: 6 },
        { challengerGames: 10, challengedGames: 8 },
      ]),
    ).not.toThrow();
  });

  it("weigert minder dan 2 sets", () => {
    expect(() => validateSets([{ challengerGames: 6, challengedGames: 4 }])).toThrow(
      InvalidScoreError,
    );
  });

  it("weigert meer dan 3 sets", () => {
    expect(() =>
      validateSets([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 3, challengedGames: 6 },
        { challengerGames: 10, challengedGames: 8 },
        { challengerGames: 6, challengedGames: 1 },
      ]),
    ).toThrow(InvalidScoreError);
  });

  it("weigert een gelijkspel binnen een set", () => {
    expect(() =>
      validateSets([
        { challengerGames: 6, challengedGames: 6 },
        { challengerGames: 6, challengedGames: 3 },
      ]),
    ).toThrow(InvalidScoreError);
  });

  it("weigert sets zonder eenduidige winnaar (1-1 bij 2 sets)", () => {
    expect(() =>
      validateSets([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 3, challengedGames: 6 },
      ]),
    ).toThrow(InvalidScoreError);
  });
});

describe("determineWinner", () => {
  it("bepaalt de challenger als winnaar bij 2-0", () => {
    expect(
      determineWinner([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 6, challengedGames: 3 },
      ]),
    ).toBe("challenger");
  });

  it("bepaalt de challenged partij als winnaar bij 1-2", () => {
    expect(
      determineWinner([
        { challengerGames: 6, challengedGames: 4 },
        { challengerGames: 3, challengedGames: 6 },
        { challengerGames: 4, challengedGames: 10 },
      ]),
    ).toBe("challenged");
  });
});
