import { describe, it, expect } from "vitest";
import {
  completeRetiredScore,
  completeInProgressSet,
  resolveScoreSubmission,
  walkoverSets,
} from "@/lib/match/resultType";
import { InvalidScoreError, determineWinner, parseScore, type SetScore } from "@/lib/match/score";

const s = (challengerGames: number, challengedGames: number): SetScore => ({ challengerGames, challengedGames });

describe("walkover", () => {
  it("geeft 6-0 6-0 voor de kant die wél kwam", () => {
    expect(walkoverSets("challenged")).toEqual([s(6, 0), s(6, 0)]);
    expect(walkoverSets("challenger")).toEqual([s(0, 6), s(0, 6)]);
  });

  it("resolveScoreSubmission: walkover is een gewone (niet-forfeit) uitslag met concedingSide", () => {
    const result = resolveScoreSubmission({ resultType: "walkover", concedingSide: "challenger" });
    expect(result).toEqual({
      resultType: "walkover",
      scoreRaw: "0-6,0-6",
      sets: [s(0, 6), s(0, 6)],
      concedingSide: "challenger",
      playedScoreRaw: null,
    });
    expect(determineWinner(parseScore(result.scoreRaw))).toBe("challenged");
  });
});

describe("completeInProgressSet (w = niet-opgevend, r = opgevend)", () => {
  it.each([
    [{ w: 0, r: 0 }, { w: 6, r: 0 }],
    [{ w: 3, r: 4 }, { w: 6, r: 4 }],
    [{ w: 5, r: 3 }, { w: 6, r: 3 }],
    [{ w: 2, r: 5 }, { w: 7, r: 5 }],
    [{ w: 6, r: 5 }, { w: 7, r: 5 }],
    [{ w: 5, r: 6 }, { w: 7, r: 6 }],
    [{ w: 6, r: 6 }, { w: 7, r: 6 }],
  ])("%o -> %o", (input, expected) => {
    expect(completeInProgressSet(input)).toEqual(expected);
  });
});

describe("completeRetiredScore", () => {
  it("opgave in de 2e set: lopende set wordt uitgespeeld door de niet-opgevende kant", () => {
    // Uitgedaagde geeft op bij 6-4, 2-3.
    expect(completeRetiredScore([s(6, 4), s(2, 3)], "challenged")).toEqual([s(6, 4), s(6, 3)]);
  });

  it("opgave door de uitdager terwijl die voorstond: resterende sets 6-0 voor de tegenpartij", () => {
    // Uitdager wint set 1 met 6-2, geeft op bij 1-1 in set 2.
    expect(completeRetiredScore([s(6, 2), s(1, 1)], "challenger")).toEqual([s(6, 2), s(1, 6), s(0, 6)]);
  });

  it("opgave in een tiebreak (6-6) → 7-6", () => {
    expect(completeRetiredScore([s(6, 3), s(6, 6)], "challenged")).toEqual([s(6, 3), s(7, 6)]);
  });

  it("opgave bij 5-5 in de derde set → 7-5", () => {
    expect(completeRetiredScore([s(6, 3), s(3, 6), s(5, 5)], "challenger")).toEqual([
      s(6, 3),
      s(3, 6),
      s(5, 7),
    ]);
  });

  it("opgave vóór de eerste game van een nieuwe set (alleen afgeronde sets opgegeven)", () => {
    expect(completeRetiredScore([s(6, 4), s(4, 6)], "challenged")).toEqual([s(6, 4), s(4, 6), s(6, 0)]);
    expect(completeRetiredScore([s(4, 6)], "challenged")).toEqual([s(4, 6), s(6, 0), s(6, 0)]);
  });

  it("opgave direct bij aanvang (0-0) telt als 6-0 6-0", () => {
    expect(completeRetiredScore([s(0, 0)], "challenger")).toEqual([s(0, 6), s(0, 6)]);
  });

  it("weigert een al beslist resultaat (dan is het een gewone uitslag)", () => {
    expect(() => completeRetiredScore([s(6, 4), s(6, 3)], "challenged")).toThrow(InvalidScoreError);
    expect(() => completeRetiredScore([s(6, 4), s(6, 3)], "challenger")).toThrow(InvalidScoreError);
    expect(() => completeRetiredScore([s(6, 4), s(3, 6), s(6, 2)], "challenger")).toThrow(InvalidScoreError);
  });

  it("weigert sets ná een beslissing", () => {
    expect(() => completeRetiredScore([s(6, 4), s(6, 3), s(1, 0)], "challenged")).toThrow(InvalidScoreError);
  });

  it("weigert een onafgemaakte set die niet de laatste is", () => {
    expect(() => completeRetiredScore([s(3, 2), s(6, 4)], "challenged")).toThrow(/alleen de laatste set/);
  });

  it.each([
    [7, 3],
    [8, 6],
    [10, 8],
    [7, 7],
  ])("weigert een onmogelijke lopende stand %i-%i", (a, b) => {
    expect(() => completeRetiredScore([s(6, 4), s(a, b)], "challenged")).toThrow(InvalidScoreError);
  });

  it("weigert negatieve of niet-gehele games en te veel/te weinig sets", () => {
    expect(() => completeRetiredScore([s(-1, 2)], "challenged")).toThrow(InvalidScoreError);
    expect(() => completeRetiredScore([s(1.5, 2)], "challenged")).toThrow(InvalidScoreError);
    expect(() => completeRetiredScore([], "challenged")).toThrow(InvalidScoreError);
    expect(() => completeRetiredScore([s(6, 4), s(4, 6), s(2, 2), s(0, 0)], "challenged")).toThrow(
      InvalidScoreError,
    );
  });

  it("de voltooide uitslag heeft altijd de niet-opgevende kant als winnaar", () => {
    const cases: Array<[SetScore[], "challenger" | "challenged"]> = [
      [[s(6, 0), s(5, 0)], "challenger"],
      [[s(0, 6), s(0, 5)], "challenged"],
      [[s(7, 6), s(6, 7), s(4, 4)], "challenged"],
    ];
    for (const [sets, retiredSide] of cases) {
      const completed = completeRetiredScore(sets, retiredSide);
      expect(determineWinner(completed)).toBe(retiredSide === "challenger" ? "challenged" : "challenger");
    }
  });

  it("resolveScoreSubmission bewaart de gespeelde stand apart", () => {
    const result = resolveScoreSubmission({
      resultType: "retired",
      sets: [s(6, 4), s(2, 3)],
      retiredSide: "challenged",
    });
    expect(result).toMatchObject({
      resultType: "retired",
      scoreRaw: "6-4,6-3",
      playedScoreRaw: "6-4,2-3",
      concedingSide: "challenged",
    });
  });
});

describe("resolveScoreSubmission — played", () => {
  it("valideert zoals voorheen", () => {
    expect(resolveScoreSubmission({ resultType: "played", sets: [s(6, 4), s(6, 3)] })).toMatchObject({
      resultType: "played",
      scoreRaw: "6-4,6-3",
      concedingSide: null,
      playedScoreRaw: null,
    });
    expect(() => resolveScoreSubmission({ resultType: "played", sets: [s(6, 4), s(2, 3)] })).toThrow(
      InvalidScoreError,
    );
  });
});
