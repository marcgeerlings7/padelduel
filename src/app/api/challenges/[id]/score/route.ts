import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { submitScoreSchema } from "@/lib/match/validation";
import { jsonError } from "@/lib/http";
import { submitScore, MatchError, type SubmitScoreInput } from "@/server/services/matchService";

/**
 * Body (KNLTB-aanvullingen; `resultType` optioneel, default "played"):
 * - { resultType?: "played", sets, idempotencyKey }
 * - { resultType: "walkover", idempotencyKey }          (door het duo dat wél kwam)
 * - { resultType: "retired", sets, retiredSide, idempotencyKey }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = submitScoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  const { idempotencyKey, ...submission } = parsed.data;
  const input: SubmitScoreInput = submission;

  try {
    const match = await submitScore(params.id, user.id, input, idempotencyKey);
    return NextResponse.json({ id: match.id }, { status: 201 });
  } catch (err) {
    if (err instanceof MatchError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
