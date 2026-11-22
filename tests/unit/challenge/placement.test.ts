import { describe, it, expect } from "vitest";
import {
  canChallengeTier,
  challengeableTierRange,
  isInPlacement,
  placementMatchesLeft,
  type PlacementConfig,
} from "@/lib/challenge/placement";

const CFG: PlacementConfig = { maxMatches: 10, tiersUp: 2 };

describe("plaatsingsperiode (laag B)", () => {
  it("in plaatsing zolang minder dan maxMatches gespeeld", () => {
    expect(isInPlacement(0, CFG)).toBe(true);
    expect(isInPlacement(9, CFG)).toBe(true);
    expect(isInPlacement(10, CFG)).toBe(false);
  });

  it("resterende plaatsingswedstrijden, nooit negatief", () => {
    expect(placementMatchesLeft(0, CFG)).toBe(10);
    expect(placementMatchesLeft(7, CFG)).toBe(3);
    expect(placementMatchesLeft(25, CFG)).toBe(0);
  });

  it("in plaatsing: eigen tier tot tiersUp hoger", () => {
    expect(challengeableTierRange(12, 3, CFG)).toEqual({ min: 12, max: 14 });
  });

  it("na plaatsing: alleen de eigen tier (FR-4.2)", () => {
    expect(challengeableTierRange(12, 10, CFG)).toEqual({ min: 12, max: 12 });
  });

  it("omlaag uitdagen mag nooit, ook niet in plaatsing", () => {
    expect(canChallengeTier(12, 0, 11, CFG)).toBe(false);
  });

  it("omhoog binnen het bereik wel, daarbuiten niet", () => {
    expect(canChallengeTier(12, 0, 12, CFG)).toBe(true);
    expect(canChallengeTier(12, 0, 14, CFG)).toBe(true);
    expect(canChallengeTier(12, 0, 15, CFG)).toBe(false);
    expect(canChallengeTier(12, 10, 13, CFG)).toBe(false);
  });

  it("tiersUp = 0 schakelt de uitzondering uit", () => {
    expect(canChallengeTier(12, 0, 13, { maxMatches: 10, tiersUp: 0 })).toBe(false);
  });

  it("weigert een ongeldige config", () => {
    expect(() => challengeableTierRange(12, 0, { maxMatches: -1, tiersUp: 2 })).toThrow();
    expect(() => challengeableTierRange(12, 0, { maxMatches: 10, tiersUp: 1.5 })).toThrow();
  });
});
