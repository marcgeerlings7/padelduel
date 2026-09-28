import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { updateProfileSchema } from "@/lib/profile/validation";
import { jsonError } from "@/lib/http";
import { getMyProfile, updateMyProfile, ProfileError } from "@/server/services/profileService";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  try {
    return NextResponse.json(await getMyProfile(user.id));
  } catch (err) {
    if (err instanceof ProfileError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}

/** { displayName?: string, knltbLevel?: number (1-9) | null } */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400, "invalid_input");
  }

  try {
    return NextResponse.json(await updateMyProfile(user.id, parsed.data));
  } catch (err) {
    if (err instanceof ProfileError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
