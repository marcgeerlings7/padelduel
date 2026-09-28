import { describe, it, expect } from "vitest";
import {
  applyMatchResult,
  applyForfeitPenalty,
  DEFAULT_K_FACTOR_CONFIG,
  DEFAULT_MARGIN_CONFIG,
  gameMargin,
  marginMultiplier,
  validateMarginConfig,
  InvalidMarginConfigError,
} from "@/lib/elo";
import { parseScore, summarizeScore, determineWinner } from "@/lib/match/score";

function duo(id: string, rating: number, matchesPlayed = 20) {
  return { id, currentRating: rating, matchesPlayed };
}

/** Games (winnaar, verliezer) volgens de KNLTB-telling, zoals matchService ze doorgeeft. */
function gamesOf(scoreRaw: string) {
  const sets = parseScore(scoreRaw);
  const s = summarizeScore(sets);
  return determineWinner(sets) === "challenger"
    ? { winner: s.challengerGames, loser: s.challengedGames }
    : { winner: s.challengedGames, loser: s.challengerGames };
}

function play(scoreRaw: string, winnerRating = 1200, loserRating = 1200) {
  const result = applyMatchResult({
    winner: duo("w", winnerRating),
    loser: duo("l", loserRating),
    winnerPercentile: 0.5,
    loserPercentile: 0.5,
    games: gamesOf(scoreRaw),
  });
  return {
    ...result,
    winnerDelta: result.winnerNewRating - winnerRating,
    loserDelta: result.loserNewRating - loserRating,
  };
}

describe("gameMargin", () => {
  it("is (G_w - G_l) / (G_w + G_l)", () => {
    expect(gameMargin(12, 0)).toBe(1);
    expect(gameMargin(12, 7)).toBeCloseTo(5 / 19);
    expect(gameMargin(12, 6)).toBeCloseTo(1 / 3);
  });

  it("is 0 als de winnaar niet meer games heeft dan de verliezer (bijv. 0-6 7-6 10-8)", () => {
    expect(gameMargin(8, 12)).toBe(0);
    expect(gameMargin(13, 13)).toBe(0);
  });

  it("weigert negatieve of niet-eindige games", () => {
    expect(() => gameMargin(-1, 3)).toThrow(RangeError);
    expect(() => gameMargin(Number.NaN, 3)).toThrow(RangeError);
  });
});

describe("marginMultiplier", () => {
  it("loopt lineair van M_min (m=0) naar M_max (m=1); 6-3 6-3 geeft exact 1.0 met de defaults", () => {
    expect(marginMultiplier(0)).toBe(DEFAULT_MARGIN_CONFIG.minMultiplier);
    expect(marginMultiplier(1)).toBe(DEFAULT_MARGIN_CONFIG.maxMultiplier);
    expect(marginMultiplier(gameMargin(12, 6))).toBeCloseTo(1.0);
  });

  it("begrenst marges buiten [0, 1]", () => {
    expect(marginMultiplier(-0.5)).toBe(0.75);
    expect(marginMultiplier(7)).toBe(1.5);
  });

  it("is monotoon niet-dalend in de marge", () => {
    let previous = -Infinity;
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const value = marginMultiplier(m);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("validateMarginConfig", () => {
  it("accepteert de defaults en min = max (gamesaldo uitgeschakeld)", () => {
    expect(() => validateMarginConfig(DEFAULT_MARGIN_CONFIG)).not.toThrow();
    expect(() => validateMarginConfig({ minMultiplier: 1, maxMultiplier: 1 })).not.toThrow();
  });

  it("weigert min <= 0, max < min en niet-eindige waarden", () => {
    expect(() => validateMarginConfig({ minMultiplier: 0, maxMultiplier: 1 })).toThrow(InvalidMarginConfigError);
    expect(() => validateMarginConfig({ minMultiplier: 1.2, maxMultiplier: 1 })).toThrow(InvalidMarginConfigError);
    expect(() => validateMarginConfig({ minMultiplier: 1, maxMultiplier: Infinity })).toThrow(
      InvalidMarginConfigError,
    );
  });
});

describe("applyMatchResult — gamesaldo (ELO_Algoritme.md §2bis)", () => {
  it("6-0 6-0 > 6-4 6-4 > 7-6 6-7 10-8 in rating-winst bij gelijke ratings", () => {
    const whitewash = play("6-0,6-0");
    const solid = play("6-4,6-4");
    const thriller = play("7-6,6-7,10-8");

    expect(whitewash.winnerDelta).toBe(18); // 24 * 1.5 * 0.5
    expect(solid.winnerDelta).toBe(11); // 24 * 0.9 * 0.5 = 10.8
    expect(thriller.winnerDelta).toBe(9); // 24 * (0.75 + 0.75/27) * 0.5 = 9.33
    expect(whitewash.winnerDelta).toBeGreaterThan(solid.winnerDelta);
    expect(solid.winnerDelta).toBeGreaterThan(thriller.winnerDelta);
  });

  it("6-3 6-3 levert exact de klassieke ELO-uitkomst op (M = 1)", () => {
    const withMargin = play("6-3,6-3", 1250, 1180);
    const classic = applyMatchResult({
      winner: duo("w", 1250),
      loser: duo("l", 1180),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
    });
    expect(withMargin.winnerNewRating).toBe(classic.winnerNewRating);
    expect(withMargin.loserNewRating).toBe(classic.loserNewRating);
    expect(withMargin.marginMultiplier).toBeCloseTo(1);
    expect(classic.marginMultiplier).toBe(1);
  });

  it("is zero-sum bij gelijke K-factoren (ook met gamesaldo en afronding)", () => {
    for (const score of ["6-0,6-0", "6-4,6-4", "7-5,7-6", "7-6,6-7,10-8", "0-6,7-6,10-8", "6-1,3-6,6-2"]) {
      for (const [rw, rl] of [
        [1200, 1200],
        [1260, 1190],
        [1190, 1260],
        [1333, 1301],
      ]) {
        const r = play(score, rw, rl);
        expect(r.winnerDelta + r.loserDelta).toBe(0);
      }
    }
  });

  it("is symmetrisch: dezelfde uitslag geeft dezelfde absolute delta aan beide kanten", () => {
    const r = play("6-2,6-4", 1210, 1240);
    expect(r.winnerDelta).toBe(-r.loserDelta);
  });

  it("winnaar wint en verliezer verliest altijd, ook bij minimale marge en een grote favoriet", () => {
    // Favoriet (E ≈ 0.99) wint nipt met minder games dan de verliezer.
    const r = play("0-6,7-6,10-8", 2000, 1200);
    expect(r.winnerDelta).toBeGreaterThanOrEqual(1);
    expect(r.loserDelta).toBeLessThanOrEqual(-1);
  });

  it("is monotoon: meer gamesaldo geeft nooit minder winst (en nooit minder verlies)", () => {
    const scores = ["7-6,6-7,10-8", "7-6,7-6", "7-5,7-5", "6-4,6-4", "6-3,6-3", "6-2,6-2", "6-1,6-1", "6-0,6-0"];
    const deltas = scores.map((s) => play(s, 1230, 1200));
    for (let i = 1; i < deltas.length; i++) {
      expect(deltas[i].winnerDelta).toBeGreaterThanOrEqual(deltas[i - 1].winnerDelta);
      expect(deltas[i].loserDelta).toBeLessThanOrEqual(deltas[i - 1].loserDelta);
    }
  });

  it("de maximale winst blijft begrensd: M_max × K × (1 - E) en nooit boven de rating-cap", () => {
    const r = applyMatchResult({
      winner: duo("w", 800, 2),
      loser: duo("l", 2200, 2),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
      games: { winner: 12, loser: 0 },
    });
    expect(r.winnerNewRating - 800).toBe(50); // 40 * 1.5 * ~1 = 60 -> cap 50
    expect(r.loserNewRating - 2200).toBe(-50);
  });

  it("combineert gamesaldo met herhaalde-tegenstander-demping (beide schalen K)", () => {
    const r = applyMatchResult({
      winner: duo("w", 1200),
      loser: duo("l", 1200),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
      isRepeatedOpponentWithinWindow: true,
      games: { winner: 12, loser: 0 },
    });
    expect(r.winnerKFactor).toBe(DEFAULT_K_FACTOR_CONFIG.establishedK * 0.5 * 1.5);
    expect(r.winnerNewRating - 1200).toBe(9);
  });

  it("gebruikt een aangepaste margin-config", () => {
    const r = applyMatchResult({
      winner: duo("w", 1200),
      loser: duo("l", 1200),
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
      games: { winner: 12, loser: 0 },
      marginConfig: { minMultiplier: 1, maxMultiplier: 2 },
    });
    expect(r.marginMultiplier).toBe(2);
    expect(r.winnerNewRating - 1200).toBe(24);
  });
});

describe("forfeits blijven buiten de gamesaldo-formule", () => {
  it("applyForfeitPenalty trekt exact de vaste penalty af, los van enige marge-configuratie", () => {
    expect(applyForfeitPenalty(duo("d", 1200), 10)).toBe(1190);
    expect(applyForfeitPenalty(duo("d", 5), 10)).toBe(0);
  });
});
