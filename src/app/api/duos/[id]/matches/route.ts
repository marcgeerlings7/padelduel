import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { duoIdParamsSchema, matchHistoryQuerySchema } from "@/lib/stats/validation";
import { getMatchHistory, StatsError } from "@/server/services/statsService";

/**
 * Wedstrijdhistorie + statistiek-samenvatting van een duo (gepagineerd).
 * Zelfde toegangsregel als /rating-history: ingelogd, maar geen
 * lidmaatschap vereist — tegenstanders mogen elkaars resultaten zien.
 * Bevat alleen duo-id's/-namen, geen e-mailadressen of user-id's.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const parsedParams = duoIdParamsSchema.safeParse(params);
  const search = request.nextUrl.searchParams;
  const parsedQuery = matchHistoryQuerySchema.safeParse({
    page: search.get("page") ?? undefined,
    pageSize: search.get("pageSize") ?? undefined,
  });
  if (!parsedParams.success || !parsedQuery.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const history = await getMatchHistory(parsedParams.data.id, parsedQuery.data);
    return NextResponse.json(history);
  } catch (err) {
    if (err instanceof StatsError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
