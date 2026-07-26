import { describe, it, expect } from "vitest";
import { getKFactor, DEFAULT_K_FACTOR_CONFIG } from "@/lib/elo";

describe("getKFactor", () => {
  it("provisional duo (< 10 matches) krijgt K=40, ongeacht positie", () => {
    expect(getKFactor({ id: "d1", currentRating: 1200, matchesPlayed: 0 }, 0.5)).toBe(40);
    expect(getKFactor({ id: "d1", currentRating: 2000, matchesPlayed: 9 }, 0.01)).toBe(40);
  });

  it("established duo (>= 10 matches), niet in de top, krijgt K=24", () => {
    expect(getKFactor({ id: "d1", currentRating: 1200, matchesPlayed: 10 }, 0.5)).toBe(24);
  });

  it("established duo in de top 10% van de ladder krijgt K=16", () => {
    expect(getKFactor({ id: "d1", currentRating: 1800, matchesPlayed: 20 }, 0.1)).toBe(16);
    expect(getKFactor({ id: "d1", currentRating: 1800, matchesPlayed: 20 }, 0.05)).toBe(16);
  });

  it("respecteert een aangepaste config i.p.v. de defaults", () => {
    const customConfig = {
      ...DEFAULT_K_FACTOR_CONFIG,
      provisionalMatchThreshold: 5,
      provisionalK: 32,
    };
    expect(getKFactor({ id: "d1", currentRating: 1200, matchesPlayed: 4 }, 0.5, customConfig)).toBe(
      32,
    );
    expect(getKFactor({ id: "d1", currentRating: 1200, matchesPlayed: 5 }, 0.5, customConfig)).toBe(
      DEFAULT_K_FACTOR_CONFIG.establishedK,
    );
  });
});
