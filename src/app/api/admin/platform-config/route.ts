import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  if (user.role !== "ADMIN") {
    return jsonError("Alleen toegankelijk voor admins.", 403, "forbidden");
  }

  const config = await prisma.platformConfig.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(config);
}
