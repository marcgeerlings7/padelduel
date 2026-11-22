import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { recalculateStartRatingsSchema } from "@/lib/admin/validation";
import { jsonError } from "@/lib/http";
import { recalculateRegionStartRatings, StartRatingAdminError } from "@/server/services/startRatingAdminService";

/** Laag D: { regionId } — herberekent startratings van nog niet gespeelde duo's. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = await request.json().catch(() => null);
  const parsed = recalculateStartRatingsSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    return NextResponse.json(await recalculateRegionStartRatings(parsed.data.regionId, admin.id));
  } catch (err) {
    if (err instanceof StartRatingAdminError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
