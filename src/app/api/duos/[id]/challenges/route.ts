import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import {
  assertDuoMember,
  listChallengesForDuo,
  ChallengeError,
} from "@/server/services/challengeService";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  try {
    await assertDuoMember(params.id, user.id);
  } catch (err) {
    if (err instanceof ChallengeError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }

  const challenges = await listChallengesForDuo(params.id);
  return NextResponse.json(challenges);
}
