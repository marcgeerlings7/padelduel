import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { updateDuoCategorySchema } from "@/lib/duo/validation";
import { jsonError } from "@/lib/http";
import { setDuoCategory, DuoError } from "@/server/services/duoService";

/** { category: "HEREN" | "DAMES" | "GEMENGD" | null } — alleen voor actieve leden. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = updateDuoCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    return NextResponse.json(await setDuoCategory(params.id, user.id, parsed.data.category));
  } catch (err) {
    if (err instanceof DuoError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
