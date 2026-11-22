import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { userIdParamSchema, verificationDecisionSchema } from "@/lib/admin/validation";
import { jsonError } from "@/lib/http";
import { decideVerification, StartRatingAdminError } from "@/server/services/startRatingAdminService";

/** { decision: "approve" | "reject" } */
export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  if (!userIdParamSchema.safeParse(params.userId).success) {
    return jsonError("Gebruiker niet gevonden.", 404, "user_not_found");
  }
  const body = await request.json().catch(() => null);
  const parsed = verificationDecisionSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    return NextResponse.json(await decideVerification(params.userId, parsed.data.decision, admin.id));
  } catch (err) {
    if (err instanceof StartRatingAdminError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
