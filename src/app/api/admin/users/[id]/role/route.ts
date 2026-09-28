import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { setUserRoleSchema, userIdParamSchema } from "@/lib/admin/validation";
import { jsonError } from "@/lib/http";
import { setUserRole, UserAdminError } from "@/server/services/userAdminService";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  if (!userIdParamSchema.safeParse(params.id).success) {
    return jsonError("Gebruiker niet gevonden.", 404, "user_not_found");
  }

  const body = await request.json().catch(() => null);
  const parsed = setUserRoleSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    const result = await setUserRole(params.id, parsed.data.role, admin.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
