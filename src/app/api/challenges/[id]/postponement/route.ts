import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requestPostponementSchema } from "@/lib/postponement/validation";
import { jsonError } from "@/lib/http";
import {
  getPostponementOverview,
  requestPostponement,
  PostponementError,
} from "@/server/services/postponementService";

/** Overzicht van (openstaand) uitstel voor een challenge; alleen voor leden van beide duo's. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  try {
    return NextResponse.json(await getPostponementOverview(params.id, user.id));
  } catch (err) {
    if (err instanceof PostponementError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}

/** Nieuw uitstelverzoek: { days, reason?, duoId? }. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = requestPostponementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const postponement = await requestPostponement(params.id, user.id, parsed.data);
    return NextResponse.json(postponement, { status: 201 });
  } catch (err) {
    if (err instanceof PostponementError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
