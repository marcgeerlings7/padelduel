import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { jsonError } from "@/lib/http";
import { revokeApiClient, ApiClientError } from "@/server/services/apiClientService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    await revokeApiClient(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiClientError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
