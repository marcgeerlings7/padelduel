import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createChallengeSchema } from "@/lib/challenge/validation";
import { jsonError } from "@/lib/http";
import { proposeChallenge, ChallengeError } from "@/server/services/challengeService";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const challenge = await proposeChallenge(
      parsed.data.challengerDuoId,
      parsed.data.challengedDuoId,
      user.id,
    );
    return NextResponse.json({ id: challenge.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ChallengeError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
