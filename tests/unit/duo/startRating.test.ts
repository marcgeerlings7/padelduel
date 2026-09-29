import { describe, it, expect } from "vitest";
import { computeStartRating, playerRatingEstimate } from "@/lib/duo/startRating";

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
