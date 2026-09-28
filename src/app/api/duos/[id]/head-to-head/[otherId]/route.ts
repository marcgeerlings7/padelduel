import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { headToHeadParamsSchema } from "@/lib/stats/validation";
import { getHeadToHead, StatsError } from "@/server/services/statsService";

/**
 * Onderling resultaat van duo `id` tegen duo `otherId` (vanuit `id`).
 * Toegang als /rating-history: ingelogd, geen lidmaatschap vereist.
 * Bevat alleen duo-id's/-namen, geen e-mailadressen of user-id's.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; otherId: string } },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const parsed = headToHeadParamsSchema.safeParse(params);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const result = await getHeadToHead(parsed.data.id, parsed.data.otherId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StatsError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
