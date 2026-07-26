import { describe, it, expect } from "vitest";
import { applyMatchResult, DEFAULT_K_FACTOR_CONFIG } from "@/lib/elo";

function duo(rating: number, matchesPlayed = 20) {
  return { id: `duo-${rating}`, currentRating: rating, matchesPlayed };
}

describe("applyMatchResult — upset-bonus", () => {
  it("een winnaar met een lagere rating dan de verliezer krijgt meer rating-winst dan een favoriet die wint", () => {
    const underdogResult = applyMatchResult({
      winner: duo(1200),
      loser: duo(1400),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
    });
    const underdogGain = underdogResult.winnerNewRating - 1200;

    const favoriteResult = applyMatchResult({
      winner: duo(1400),
      loser: duo(1200),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
    });
    const favoriteGain = favoriteResult.winnerNewRating - 1400;

    expect(underdogGain).toBeGreaterThan(favoriteGain);
  });
});

describe("applyMatchResult — rating-cap", () => {
  it("de rating-winst/verlies per match overschrijdt nooit de cap, ook met een extreem rating-verschil en hoge K", () => {
    const result = applyMatchResult({
      winner: duo(800, 2), // provisional -> hoge K uit een aangepaste config
      loser: duo(2200, 2),
      winnerPercentile: 0.9,
      loserPercentile: 0.5,
      kFactorConfig: { ...DEFAULT_K_FACTOR_CONFIG, provisionalK: 100 },
      ratingCap: 50,
    });

    // Zonder cap zou de underdog-winst hier dicht bij K (100) liggen.
    expect(result.winnerNewRating - 800).toBeLessThanOrEqual(50);
    expect(result.winnerNewRating - 800).toBeGreaterThan(40); // cap moet ook echt geraakt worden
  });

  it("gebruikt de default cap van 50 als er geen aangepaste cap wordt meegegeven", () => {
    const result = applyMatchResult({
      winner: duo(800, 2),
      loser: duo(2200, 2),
      winnerPercentile: 0.9,
      loserPercentile: 0.5,
      kFactorConfig: { ...DEFAULT_K_FACTOR_CONFIG, provisionalK: 100 },
    });
    expect(result.winnerNewRating - 800).toBe(50);
  });
});

describe("applyMatchResult — herhaalde-tegenstander-demping", () => {
  it("halveert de K-factor van beide duo's bij een herhaalde wedstrijd binnen het venster", () => {
    const base = {
      winner: duo(1400, 20),
      loser: duo(1200, 20),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
    };

    const normal = applyMatchResult(base);
    const repeated = applyMatchResult({ ...base, isRepeatedOpponentWithinWindow: true });

    expect(repeated.winnerKFactor).toBe(normal.winnerKFactor / 2);
    expect(repeated.loserKFactor).toBe(normal.loserKFactor / 2);
    expect(Math.abs(repeated.winnerNewRating - 1400)).toBeLessThan(
      Math.abs(normal.winnerNewRating - 1400),
    );
  });
});

describe("applyMatchResult — algemeen", () => {
  it("geeft de gebruikte k-factoren terug (nodig voor RatingHistory.k_factor)", () => {
    const result = applyMatchResult({
      winner: duo(1200, 5),
      loser: duo(1200, 20),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
    });
    expect(result.winnerKFactor).toBe(DEFAULT_K_FACTOR_CONFIG.provisionalK);
    expect(result.loserKFactor).toBe(DEFAULT_K_FACTOR_CONFIG.establishedK);
  });

  it("de rating gaat nooit onder 0", () => {
    const result = applyMatchResult({
      winner: duo(1200, 20),
      loser: duo(10, 20),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
      ratingCap: 1000,
    });
    expect(result.loserNewRating).toBeGreaterThanOrEqual(0);
  });
});
