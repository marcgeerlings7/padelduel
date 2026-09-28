import { describe, expect, it } from "vitest";
import {
  DEMO_MATCHUPS,
  DEMO_SCORELINES,
  computeDemoOutcome,
  formatDecimal,
  formatPercent,
  groupTopByTier,
  type PreviewEntry,
} from "@/components/public/landing-data";

const byId = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`onbekend id ${id}`);
  return found;
};

describe("computeDemoOutcome", () => {
  const even = byId(DEMO_MATCHUPS, "even");

  it("reproduceert de rekentabel uit ELO_Algoritme.md §2bis (gelijkwaardig, K = 24)", () => {
    const expected: Record<string, number> = { "60-60": 18, "63-63": 12, "64-64": 11, "76-67-108": 9 };
    for (const scoreline of DEMO_SCORELINES) {
      const outcome = computeDemoOutcome(even, scoreline);
      expect(outcome.winnerDelta).toBe(expected[scoreline.id]);
      expect(outcome.loserDelta).toBe(-expected[scoreline.id]);
      expect(outcome.baseK).toBe(24);
      expect(outcome.winnerExpected).toBeCloseTo(0.5);
    }
  });

  it("telt een match-tiebreak als 1-0 in games (KNLTB)", () => {
    const outcome = computeDemoOutcome(even, byId(DEMO_SCORELINES, "76-67-108"));
    expect(outcome.winnerGames).toBe(14);
    expect(outcome.loserGames).toBe(13);
  });

  it("geeft een underdog meer punten dan een favoriet bij dezelfde uitslag", () => {
    const scoreline = byId(DEMO_SCORELINES, "63-63");
    const favorite = computeDemoOutcome(byId(DEMO_MATCHUPS, "favorite"), scoreline);
    const underdog = computeDemoOutcome(byId(DEMO_MATCHUPS, "underdog"), scoreline);
    expect(underdog.winnerDelta).toBeGreaterThan(favorite.winnerDelta);
    expect(favorite.winnerDelta).toBeGreaterThanOrEqual(1);
  });
});

describe("groupTopByTier", () => {
  const entry = (position: number, tier: number): PreviewEntry => ({
    id: `d${position}`,
    name: `Duo ${position}`,
    position,
    tier,
    currentRating: tier * 100 + 50,
    wins: 0,
    losses: 0,
    streak: "—",
  });

  it("neemt de bovenste N in ladder-volgorde en groepeert per aaneengesloten tier", () => {
    const groups = groupTopByTier([entry(3, 12), entry(1, 13), entry(2, 13), entry(4, 12), entry(5, 11)], 4);
    expect(groups.map((g) => [g.tier, g.entries.map((e) => e.position)])).toEqual([
      [13, [1, 2]],
      [12, [3, 4]],
    ]);
  });

  it("geeft een lege lijst bij een lege ladder", () => {
    expect(groupTopByTier([], 5)).toEqual([]);
  });
});

describe("formatters", () => {
  it("formatteert Nederlands", () => {
    expect(formatDecimal(0.5)).toBe("0,50");
    expect(formatDecimal(1.125, 3)).toBe("1,125");
    expect(formatPercent(0.6)).toBe("60%");
  });
});
