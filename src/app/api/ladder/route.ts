import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { getLadder } from "@/server/services/ladderService";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export async function GET(request: NextRequest) {
  const regionSlug = request.nextUrl.searchParams.get("regionSlug");
  if (!regionSlug) {
    return jsonError("regionSlug is verplicht.", 400, "invalid_input");
  }

  const region = await prisma.region.findUnique({ where: { slug: regionSlug } });
  if (!region) {
    return jsonError("Regio niet gevonden.", 404, "region_not_found");
  }

  const [ladder, tierSize] = await Promise.all([
    getLadder(region.id),
    getConfigNumber("rating_tier_size"),
  ]);
  return NextResponse.json({ region, ladder, tierSize });
}
