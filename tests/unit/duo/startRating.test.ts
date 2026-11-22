import { describe, it, expect } from "vitest";
import {
  computeDuoStartRating,
  computeStartRating,
  levelBonus,
  playerRatingEstimate,
  playerStartEstimate,
  type PlayerStartInput,
  type StartRatingConfig,
} from "@/lib/duo/startRating";

describe("playerRatingEstimate", () => {
  it("gemiddelde van de andere actieve duo's", () => {
    expect(playerRatingEstimate([1300, 1100], 1200)).toBe(1200);
    expect(playerRatingEstimate([1400], 1200)).toBe(1400);
  });

  it("zonder duo's: de default", () => {
    expect(playerRatingEstimate([], 1200)).toBe(1200);
  });
});

describe("computeStartRating", () => {
  it("twee nieuwe spelers starten op de default", () => {
    expect(computeStartRating({ playerARatings: [], playerBRatings: [], defaultRating: 1200 })).toBe(1200);
  });

  it("één ervaren speler en één nieuwe speler: gemiddelde met de default", () => {
    expect(computeStartRating({ playerARatings: [1400], playerBRatings: [], defaultRating: 1200 })).toBe(1300);
  });

  it("per speler eerst middelen, daarna tussen spelers (geen gewicht naar aantal duo's)", () => {
    // A: (1500 + 1300) / 2 = 1400; B: 1000 → (1400 + 1000) / 2 = 1200.
    expect(
      computeStartRating({ playerARatings: [1500, 1300], playerBRatings: [1000], defaultRating: 1200 }),
    ).toBe(1200);
  });

  it("rondt af op een geheel getal", () => {
    expect(computeStartRating({ playerARatings: [1201], playerBRatings: [1200], defaultRating: 1200 })).toBe(
      1201,
    ); // 1200.5 → 1201
    expect(computeStartRating({ playerARatings: [1333, 1334], playerBRatings: [], defaultRating: 1200 })).toBe(
      1267,
    );
  });

  it("volgt een gewijzigde default uit platform_config", () => {
    expect(computeStartRating({ playerARatings: [], playerBRatings: [], defaultRating: 1000 })).toBe(1000);
  });

  it("weigert een ongeldige default", () => {
    expect(() => computeStartRating({ playerARatings: [], playerBRatings: [], defaultRating: NaN })).toThrow();
    expect(() => computeStartRating({ playerARatings: [], playerBRatings: [], defaultRating: -5 })).toThrow();
  });
});

const CFG: StartRatingConfig = { defaultRating: 1200, levelStep: 50, unverifiedMaxBonus: 200, verifiedMaxBonus: 400 };
const player = (overrides: Partial<PlayerStartInput> = {}): PlayerStartInput => ({
  playedDuoRatings: [],
  knltbLevel: null,
  levelVerified: false,
  ...overrides,
});

describe("levelBonus (laag A + C)", () => {
  it("geen speelsterkte of beginner (9): geen bonus", () => {
    expect(levelBonus(null, false, CFG)).toBe(0);
    expect(levelBonus(9, false, CFG)).toBe(0);
  });

  it("elke stap sterker = + levelStep", () => {
    expect(levelBonus(8, false, CFG)).toBe(50);
    expect(levelBonus(6, false, CFG)).toBe(150);
  });

  it("ongeverifieerd begrensd op unverifiedMaxBonus", () => {
    expect(levelBonus(5, false, CFG)).toBe(200);
    expect(levelBonus(1, false, CFG)).toBe(200);
  });

  it("geverifieerd begrensd op verifiedMaxBonus", () => {
    expect(levelBonus(5, true, CFG)).toBe(200);
    expect(levelBonus(3, true, CFG)).toBe(300);
    expect(levelBonus(1, true, CFG)).toBe(400);
  });

  it("verificatie levert nooit minder op, ook bij een vreemde config", () => {
    expect(levelBonus(1, true, { ...CFG, verifiedMaxBonus: 100 })).toBe(200);
  });

  it("ongeldige speelsterkte telt als geen speelsterkte (alleen omhoog, nooit negatief)", () => {
    expect(levelBonus(0, true, CFG)).toBe(0);
    expect(levelBonus(10, false, CFG)).toBe(0);
    expect(levelBonus(2.5, false, CFG)).toBe(0);
  });
});

describe("playerStartEstimate", () => {
  it("echte (gespeelde) duo-ratings gaan voor de speelsterkte", () => {
    expect(playerStartEstimate(player({ playedDuoRatings: [1100, 1300], knltbLevel: 1, levelVerified: true }), CFG)).toBe(
      1200,
    );
  });

  it("zonder gespeelde duo's: default + bonus", () => {
    expect(playerStartEstimate(player({ knltbLevel: 7 }), CFG)).toBe(1300);
    expect(playerStartEstimate(player(), CFG)).toBe(1200);
  });
});

describe("computeDuoStartRating", () => {
  it("twee nieuwe spelers zonder speelsterkte: default", () => {
    expect(computeDuoStartRating(player(), player(), CFG)).toBe(1200);
  });

  it("twee geverifieerde topspelers (1): default + verifiedMaxBonus", () => {
    const top = player({ knltbLevel: 1, levelVerified: true });
    expect(computeDuoStartRating(top, top, CFG)).toBe(1600);
  });

  it("ongeverifieerde topspeler + beginner: gemiddelde, afgerond", () => {
    expect(computeDuoStartRating(player({ knltbLevel: 1 }), player({ knltbLevel: 9 }), CFG)).toBe(1300);
    expect(computeDuoStartRating(player({ knltbLevel: 8 }), player(), CFG)).toBe(1225);
  });

  it("ervaren speler + nieuwe speler met speelsterkte", () => {
    expect(computeDuoStartRating(player({ playedDuoRatings: [1500] }), player({ knltbLevel: 5 }), CFG)).toBe(1450);
  });

  it("weigert een ongeldige config", () => {
    expect(() => computeDuoStartRating(player(), player(), { ...CFG, levelStep: -1 })).toThrow();
    expect(() => computeDuoStartRating(player(), player(), { ...CFG, defaultRating: Number.NaN })).toThrow();
  });
});
