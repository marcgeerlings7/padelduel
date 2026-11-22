import { z } from "zod";

export const setUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export const userIdParamSchema = z.string().uuid();

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
});

/** Startrating & plaatsing (akkoord PO 2026-11-22). */
export const verificationDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export const recalculateStartRatingsSchema = z.object({
  regionId: z.string().uuid(),
});
