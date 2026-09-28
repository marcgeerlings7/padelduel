import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { answerPostponementSchema } from "@/lib/postponement/validation";
import { jsonError } from "@/lib/http";
import { answerPostponement, PostponementError } from "@/server/services/postponementService";

/**
 * { action: "accept" | "decline" } door het andere duo, of
 * { action: "cancel" } door het duo dat het verzoek deed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; postponementId: string } },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = answerPostponementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const postponement = await answerPostponement(params.id, params.postponementId, user.id, parsed.data.action);
    return NextResponse.json(postponement);
  } catch (err) {
    if (err instanceof PostponementError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
