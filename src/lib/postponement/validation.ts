import { z } from "zod";

/**
 * Uitstel in onderling overleg (KNLTB-aanvullingen, akkoord PO
 * 2026-09-28). Het maximum aantal dagen is tunable
 * (platform_config.postponement_max_days) en wordt in de service
 * gecontroleerd; hier alleen de vormcontrole.
 */
export const requestPostponementSchema = z
  .object({
    days: z.number().int().min(1).max(365),
    reason: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().max(500))
      .optional()
      .transform((v) => (v ? v : undefined)),
    /** Alleen nodig als je lid bent van beide duo's van de challenge. */
    duoId: z.string().uuid().optional(),
  })
  .strict();

export type RequestPostponementInput = z.infer<typeof requestPostponementSchema>;

export const answerPostponementSchema = z
  .object({
    action: z.enum(["accept", "decline", "cancel"]),
  })
  .strict();

export type AnswerPostponementInput = z.infer<typeof answerPostponementSchema>;
