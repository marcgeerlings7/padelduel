import { describe, expect, it } from "vitest";
import {
  describeReliability,
  describeStreak,
  formatRecord,
  formatReliability,
  groupByTier,
  ratingGap,
  tierRange,
} from "@/components/ladder/ladder-model";

describe("groupByTier", () => {
  it("groepeert aaneengesloten tiers en behoudt de API-volgorde", () => {
    const groups = groupByTier([
      { id: "a", tier: 13 },
      { id: "b", tier: 13 },
      { id: "c", tier: 12 },
      { id: "d", tier: 10 },
      { id: "e", tier: 10 },
    ]);
    expect(groups.map((g) => g.tier)).toEqual([13, 12, 10]);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(groups[2].entries.map((e) => e.id)).toEqual(["d", "e"]);
  });

  it("geeft een lege lijst voor een lege ladder", () => {
    expect(groupByTier([])).toEqual([]);
  });
});

describe("tierRange", () => {
  it("berekent het bereik uit tier en tierSize", () => {
    expect(tierRange(13, 100)).toEqual({ min: 1300, max: 1399 });
    expect(tierRange(0, 50)).toEqual({ min: 0, max: 49 });
  });

  it("geeft null zonder geldige tierSize", () => {
    expect(tierRange(13, null)).toBeNull();
    expect(tierRange(13, 0)).toBeNull();
  });
});

describe("formatters", () => {
  it("beschrijft reeksen", () => {
    expect(describeStreak(null)).toBe("Nog geen reeks");
    expect(describeStreak({ result: "W", length: 3 })).toBe("3 keer op rij gewonnen");
    expect(describeStreak({ result: "L", length: 1 })).toBe("1 keer verloren");
  });

  it("formatteert betrouwbaarheid", () => {
    expect(formatReliability({ played: 0, total: 0, percentage: null })).toBe("—");
    expect(formatReliability({ played: 11, total: 12, percentage: 92 })).toBe("92%");
    expect(describeReliability({ played: 11, total: 12, percentage: 92 })).toBe(
      "Betrouwbaarheid 92%: 11 van 12 challenges gespeeld",
    );
  });

  it("formatteert record en ratingverschil", () => {
    expect(formatRecord(4, 1)).toBe("4–1");
    expect(ratingGap(1380, 1395.4)).toBe(15);
    expect(ratingGap(1395, 1380)).toBe(15);
  });
});
