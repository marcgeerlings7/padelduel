import { z } from "zod";

export const submitScoreSchema = z.object({
  sets: z
    .array(
      z.object({
        challengerGames: z.number().int().min(0),
        challengedGames: z.number().int().min(0),
      }),
    )
    .min(2)
    .max(3),
  idempotencyKey: z.string().trim().min(1).max(100),
});

export const respondToMatchSchema = z.object({
  decision: z.enum(["confirm", "dispute"]),
});
