import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { getCurrentUser, AuthenticatedUser } from "./currentUser";

/**
 * Server-side admin-autorisatie voor alle /api/admin/*-routes.
 *
 * Post-v1: de rol wordt — naast het geverifieerde sessietoken — opnieuw uit
 * de database gelezen. Het JWT bevat de rol van het inlogmoment (TTL 2 uur);
 * zonder deze extra check zou een zojuist gedegradeerde admin tot het
 * verlopen van zijn token admin-rechten houden. Kost één lookup op de
 * primary key per admin-request.
 *
 * Geeft de admin terug, of een kant-en-klare 401/403-response.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const tokenUser = await getCurrentUser(request);
  if (!tokenUser) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: { id: true, role: true, isActive: true },
  });
  if (!dbUser || !dbUser.isActive || dbUser.role !== "ADMIN") {
    return jsonError("Alleen toegankelijk voor admins.", 403, "forbidden");
  }

  return { id: dbUser.id, role: "ADMIN" };
}
