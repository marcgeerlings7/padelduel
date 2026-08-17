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

export const updateAvailabilitySchema = createAvailabilitySchema;
