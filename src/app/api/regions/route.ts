import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(regions);
}
