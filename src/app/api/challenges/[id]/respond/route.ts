import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { respondToChallengeSchema } from "@/lib/challenge/validation";
import { jsonError } from "@/lib/http";
import { respondToChallenge, ChallengeError } from "@/server/services/challengeService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = respondToChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    await respondToChallenge(params.id, user.id, parsed.data.decision);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChallengeError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
