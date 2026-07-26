import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { proposeDuoSchema } from "@/lib/duo/validation";
import { jsonError } from "@/lib/http";
import { proposeDuo, DuoError } from "@/server/services/duoService";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = proposeDuoSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const invitation = await proposeDuo(user.id, parsed.data);
    return NextResponse.json({ invitationId: invitation.id }, { status: 201 });
  } catch (err) {
    if (err instanceof DuoError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
