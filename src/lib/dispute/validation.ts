import { z } from "zod";

export const openDisputeSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const resolveMatchScoreDisputeSchema = z.object({
  resolution: z.enum(["upheld", "overturned"]),
  notes: z.string().trim().max(1000).optional(),
});

export const resolveForfeitDisputeSchema = z
  .object({
    resolution: z.enum(["upheld", "overturned"]),
    atFaultDuoId: z.string().uuid().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.resolution !== "overturned" || Boolean(data.atFaultDuoId), {
    message: "atFaultDuoId is verplicht bij resolution=overturned.",
    path: ["atFaultDuoId"],
  });
