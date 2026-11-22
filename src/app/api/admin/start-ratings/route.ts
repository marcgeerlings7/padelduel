import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getStartRatingOverview } from "@/server/services/startRatingAdminService";

export const dynamic = "force-dynamic";

/** Openstaande verificatie-aanvragen + regio's voor lanceer-seeding. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json(await getStartRatingOverview());
}
