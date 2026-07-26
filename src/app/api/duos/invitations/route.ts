import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { listMyInvitations } from "@/server/services/duoService";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const invitations = await listMyInvitations(user.id);
  return NextResponse.json(invitations);
}
