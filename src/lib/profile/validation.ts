import { z } from "zod";

/**
 * Spelersprofiel (KNLTB-aanvullingen, akkoord PO 2026-09-28).
 *
 * Weergavenaam: 2-40 tekens na trimmen (meervoudige spaties worden één),
 * alleen letters (incl. accenten), cijfers, spatie en . ' - _. Bewust geen
 * "@": zo kan een e-mailadres nooit als publieke naam worden ingevuld.
 * Niet uniek — de publieke identiteit op de ladder is de duo-naam.
 */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}0-9 .'_-]+$/u;

export const displayNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(DISPLAY_NAME_MIN_LENGTH, `Je naam moet minimaal ${DISPLAY_NAME_MIN_LENGTH} tekens bevatten.`)
      .max(DISPLAY_NAME_MAX_LENGTH, `Je naam mag maximaal ${DISPLAY_NAME_MAX_LENGTH} tekens bevatten.`)
      .regex(
        DISPLAY_NAME_PATTERN,
        "Je naam mag alleen letters, cijfers, spaties en . ' - _ bevatten.",
      ),
  );

/**
 * Zelf opgegeven KNLTB-speelsterkte (1 = sterkst, 9 = beginner). Wordt
 * NIET geverifieerd bij de KNLTB en er wordt geen bondsnummer opgeslagen.
 */
export const KNLTB_LEVEL_MIN = 1;
export const KNLTB_LEVEL_MAX = 9;
export const knltbLevelSchema = z.number().int().min(KNLTB_LEVEL_MIN).max(KNLTB_LEVEL_MAX);

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    // null = speelsterkte wissen.
    knltbLevel: knltbLevelSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => value.displayName !== undefined || value.knltbLevel !== undefined, {
    message: "Geef minimaal één veld op om te wijzigen.",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
