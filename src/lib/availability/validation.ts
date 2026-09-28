import { z } from "zod";

// HH:MM, 24-uurs.
const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Gebruik het formaat UU:MM.");

export const createAvailabilitySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6), // 0 = maandag
    startTime: timeString,
    endTime: timeString,
    recurring: z.boolean().optional().default(true),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "end_time moet na start_time liggen.",
    path: ["endTime"],
  });

// Volledige vervanging (PATCH vervangt alle velden): zelfde regels als aanmaken.
export const updateAvailabilitySchema = createAvailabilitySchema;

export const availabilityIdSchema = z.string().uuid();

/**
 * Client-side hergebruik van hetzelfde schema (US-H1/H2): geeft een
 * Nederlandstalige foutmelding voor de eerste fout, of null als de invoer
 * geldig is. De API valideert server-side opnieuw met createAvailabilitySchema.
 */
export function validateAvailabilityInput(input: unknown): string | null {
  const parsed = createAvailabilitySchema.safeParse(input);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  const field = issue?.path[0];
  if (field === "endTime" && issue?.code === "custom") {
    return "De eindtijd moet na de begintijd liggen.";
  }
  if (field === "startTime" || field === "endTime") {
    return "Vul een geldige tijd in (UU:MM).";
  }
  if (field === "dayOfWeek") {
    return "Kies een geldige dag.";
  }
  return "Ongeldige invoer.";
}
