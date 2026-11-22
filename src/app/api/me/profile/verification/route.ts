import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { ProfileError, requestKnltbVerification } from "@/server/services/profileService";

/** Laag C: verificatie van de eigen KNLTB-speelsterkte aanvragen. Geen body. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  try {
    return NextResponse.json(await requestKnltbVerification(user.id));
  } catch (err) {
    if (err instanceof ProfileError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
