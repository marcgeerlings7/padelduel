import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sortRegionsDemoLast } from "@/lib/region/demo";

// Zonder request-afhankelijkheid zou Next.js deze route bij de build statisch
// vastleggen (met de regio's van dát moment — op productie: een lege lijst).
export const dynamic = "force-dynamic";

export async function GET() {
  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  // De demoregio komt achteraan, zodat keuzelijsten en de ladder standaard
  // een echte regio tonen (demo-accounts, verzoek PO 2026-11-22).
  return NextResponse.json(sortRegionsDemoLast(regions));
}
