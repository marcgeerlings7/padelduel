import { describe, it, expect } from "vitest";
import { expectedScore } from "@/lib/elo";

describe("expectedScore", () => {
  it("de verwachte score van beide duo's samen is altijd 1", () => {
    const eA = expectedScore(1400, 1200);
    const eB = expectedScore(1200, 1400);
    expect(eA + eB).toBeCloseTo(1, 10);
  });

  it("gelijke ratings geven beide duo's een verwachte score van 0.5", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it("een hogere rating geeft een hogere verwachte score", () => {
    expect(expectedScore(1400, 1200)).toBeGreaterThan(expectedScore(1200, 1400));
  });
});
