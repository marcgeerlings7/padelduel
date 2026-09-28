import { z } from "zod";

export const MAX_HISTORY_PAGE_SIZE = 100;
export const DEFAULT_HISTORY_PAGE_SIZE = 20;

export const duoIdParamsSchema = z.object({ id: z.string().uuid() });

export const headToHeadParamsSchema = z
  .object({ id: z.string().uuid(), otherId: z.string().uuid() })
  .refine((p) => p.id !== p.otherId, { message: "Een duo heeft geen onderling resultaat met zichzelf." });

/** Query-parameters komen als string binnen; lege/afwezige waarden → defaults. */
export const matchHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_HISTORY_PAGE_SIZE).default(DEFAULT_HISTORY_PAGE_SIZE),
});
