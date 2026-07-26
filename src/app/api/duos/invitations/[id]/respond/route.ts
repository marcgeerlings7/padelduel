import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { respondToInvitationSchema } from "@/lib/duo/validation";
import { jsonError } from "@/lib/http";
import { respondToInvitation, DuoError } from "@/server/services/duoService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = respondToInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const result = await respondToInvitation(params.id, user.id, parsed.data.decision);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DuoError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
