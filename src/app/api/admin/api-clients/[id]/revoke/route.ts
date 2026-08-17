import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { revokeApiClient, ApiClientError } from "@/server/services/apiClientService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("Niet ingelogd.", 401, "unauthorized");
  if (user.role !== "ADMIN") return jsonError("Alleen toegankelijk voor admins.", 403, "forbidden");

  try {
    await revokeApiClient(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiClientError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
