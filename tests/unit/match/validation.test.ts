import { describe, it, expect } from "vitest";
import { submitScoreSchema } from "@/lib/match/validation";

const sets = [
  { challengerGames: 6, challengedGames: 4 },
  { challengerGames: 6, challengedGames: 3 },
];

describe("submitScoreSchema", () => {
  it("zonder resultType = played (backwards compatible)", () => {
    const parsed = submitScoreSchema.parse({ sets, idempotencyKey: "k1" });
    expect(parsed).toEqual({ resultType: "played", sets, idempotencyKey: "k1" });
  });

  it("walkover zonder sets", () => {
    expect(submitScoreSchema.parse({ resultType: "walkover", idempotencyKey: "k" })).toEqual({
      resultType: "walkover",
      idempotencyKey: "k",
    });
  });

  it("walkover mét sets wordt geweigerd (strict)", () => {
    expect(submitScoreSchema.safeParse({ resultType: "walkover", sets, idempotencyKey: "k" }).success).toBe(false);
  });

  it("retired vereist retiredSide en 1-3 sets", () => {
    expect(
      submitScoreSchema.safeParse({
        resultType: "retired",
        sets: [{ challengerGames: 3, challengedGames: 2 }],
        retiredSide: "challenged",
        idempotencyKey: "k",
      }).success,
    ).toBe(true);
    expect(submitScoreSchema.safeParse({ resultType: "retired", sets, idempotencyKey: "k" }).success).toBe(false);
    expect(
      submitScoreSchema.safeParse({ resultType: "retired", sets: [], retiredSide: "challenger", idempotencyKey: "k" })
        .success,
    ).toBe(false);
  });

  it("played blijft 2-3 sets eisen en onbekende resultType wordt geweigerd", () => {
    expect(submitScoreSchema.safeParse({ sets: [sets[0]], idempotencyKey: "k" }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ resultType: "forfeit", idempotencyKey: "k" }).success).toBe(false);
    expect(submitScoreSchema.safeParse(null).success).toBe(false);
  });
});
