import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Zonder request-afhankelijkheid zou Next.js deze route bij de build statisch
// vastleggen (met de regio's van dát moment — op productie: een lege lijst).
export const dynamic = "force-dynamic";

export async function GET() {
  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(regions);
}
