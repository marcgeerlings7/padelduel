import { z } from "zod";

const setScoreSchema = z.object({
  challengerGames: z.number().int().min(0).max(99),
  challengedGames: z.number().int().min(0).max(99),
});

const idempotencyKeySchema = z.string().trim().min(1).max(100);

/**
 * KNLTB-aanvullingen (akkoord PO 2026-09-28): `resultType` is optioneel en
 * default "played", zodat bestaande clients ({ sets, idempotencyKey })
 * ongewijzigd blijven werken.
 *
 * - played:   2-3 volledige sets.
 * - walkover: geen sets; de indienende (wél gekomen) kant wint 6-0 6-0.
 * - retired:  1-3 sets, de laatste mag onafgemaakt zijn; `retiredSide` =
 *             de kant die opgaf (mag door beide duo's ingediend worden).
 */
export const submitScoreSchema = z.preprocess(
  (body) =>
    body && typeof body === "object" && !("resultType" in body)
      ? { ...(body as Record<string, unknown>), resultType: "played" }
      : body,
  z.discriminatedUnion("resultType", [
    z
      .object({
        resultType: z.literal("played"),
        sets: z.array(setScoreSchema).min(2).max(3),
        idempotencyKey: idempotencyKeySchema,
      })
      .strict(),
    z
      .object({
        resultType: z.literal("walkover"),
        idempotencyKey: idempotencyKeySchema,
      })
      .strict(),
    z
      .object({
        resultType: z.literal("retired"),
        sets: z.array(setScoreSchema).min(1).max(3),
        retiredSide: z.enum(["challenger", "challenged"]),
        idempotencyKey: idempotencyKeySchema,
      })
      .strict(),
  ]),
);

export type SubmitScoreBody = z.infer<typeof submitScoreSchema>;

export const respondToMatchSchema = z.object({
  decision: z.enum(["confirm", "dispute"]),
});
