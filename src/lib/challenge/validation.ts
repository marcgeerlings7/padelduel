import { z } from "zod";

export const createChallengeSchema = z.object({
  challengerDuoId: z.string().uuid(),
  challengedDuoId: z.string().uuid(),
});

export const respondToChallengeSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
