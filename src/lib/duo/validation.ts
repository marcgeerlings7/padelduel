import { z } from "zod";

export const proposeDuoSchema = z.object({
  // Optioneel: als je geen naam invult, verzint het systeem er een (gimmick).
  duoName: z.string().trim().min(1).max(100).optional(),
  regionSlug: z.string().trim().min(1),
  invitedEmail: z.string().trim().toLowerCase().email(),
});

export const respondToInvitationSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
