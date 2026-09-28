import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listUsersQuerySchema } from "@/lib/admin/validation";
import { jsonError } from "@/lib/http";
import { listUsers } from "@/server/services/userAdminService";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const parsed = listUsersQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  const users = await listUsers(parsed.data.q);
  return NextResponse.json(users);
}
