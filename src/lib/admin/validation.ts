import { z } from "zod";

export const setUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export const userIdParamSchema = z.string().uuid();

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
});
