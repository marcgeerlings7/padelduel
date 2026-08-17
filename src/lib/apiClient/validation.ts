import { z } from "zod";

export const createApiClientSchema = z.object({
  name: z.string().trim().min(1).max(150),
  regionId: z.string().uuid().optional(),
});
