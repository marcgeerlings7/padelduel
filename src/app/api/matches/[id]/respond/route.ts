import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { respondToMatchSchema } from "@/lib/match/validation";
import { jsonError } from "@/lib/http";
import { respondToMatch, MatchError } from "@/server/services/matchService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = respondToMatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const result = await respondToMatch(params.id, user.id, parsed.data.decision);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MatchError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
