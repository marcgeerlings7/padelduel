import { z } from "zod";

export const proposeDuoSchema = z.object({
  // Optioneel: als je geen naam invult, verzint het systeem er een (gimmick).
  duoName: z.string().trim().min(1).max(100).optional(),
  regionSlug: z.string().trim().min(1),
  invitedEmail: z.string().trim().toLowerCase().email(),
  // KNLTB-aanvullingen: optioneel speltype (heren-/dames-/gemengd dubbel);
  // zelfde waarden als de DB-enum, zodat lezen en schrijven gelijk zijn.
  category: z.enum(["HEREN", "DAMES", "GEMENGD"]).optional(),
});

export const duoCategorySchema = z.enum(["HEREN", "DAMES", "GEMENGD"]);
export type DuoCategoryName = z.infer<typeof duoCategorySchema>;

export const updateDuoCategorySchema = z
  .object({
    // null = speltype wissen.
    category: duoCategorySchema.nullable(),
  })
  .strict();

export const respondToInvitationSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
