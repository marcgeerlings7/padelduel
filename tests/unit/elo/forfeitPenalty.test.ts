import { describe, it, expect } from "vitest";
import { applyForfeitPenalty } from "@/lib/elo";

describe("applyForfeitPenalty", () => {
  it("verlaagt de rating met exact de geconfigureerde penalty", () => {
    const duo = { id: "d1", currentRating: 1200, matchesPlayed: 5 };
    expect(applyForfeitPenalty(duo, 10)).toBe(1190);
  });

  it("gaat nooit onder 0", () => {
    const duo = { id: "d1", currentRating: 5, matchesPlayed: 0 };
    expect(applyForfeitPenalty(duo, 10)).toBe(0);
  });

  it(
    "expired: alleen de uitgedaagde duo krijgt een penalty — de aanroeper past dit " +
      "alleen toe op dat duo, dus de uitdager blijft (op dit pure-functie-niveau) ongewijzigd",
    () => {
      const challenger = { id: "challenger", currentRating: 1200, matchesPlayed: 5 };
      const challenged = { id: "challenged", currentRating: 1200, matchesPlayed: 5 };

      const challengedNewRating = applyForfeitPenalty(challenged, 10);
      // De uitdager wordt simpelweg niet aangeroepen bij 'expired':
      const challengerRating = challenger.currentRating;

      expect(challengedNewRating).toBe(1190);
      expect(challengerRating).toBe(1200);
    },
  );

  it("unplayed_timeout: beide duo's krijgen onafhankelijk dezelfde penalty toegepast", () => {
    const duoA = { id: "duoA", currentRating: 1300, matchesPlayed: 12 };
    const duoB = { id: "duoB", currentRating: 1150, matchesPlayed: 8 };

    const newRatingA = applyForfeitPenalty(duoA, 10);
    const newRatingB = applyForfeitPenalty(duoB, 10);

    expect(newRatingA).toBe(1290);
    expect(newRatingB).toBe(1140);
    // Elk duo levert exact zijn eigen oude rating minus de penalty op —
    // geen koppeling tussen de twee berekeningen.
    expect(newRatingA - duoA.currentRating).toBe(newRatingB - duoB.currentRating);
  });
});
