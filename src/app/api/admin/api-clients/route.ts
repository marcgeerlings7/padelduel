import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createApiClientSchema } from "@/lib/apiClient/validation";
import { jsonError } from "@/lib/http";
import { createApiClient, listApiClients, ApiClientError } from "@/server/services/apiClientService";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const clients = await listApiClients();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const parsed = createApiClientSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    const result = await createApiClient(parsed.data.name, parsed.data.regionId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiClientError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
