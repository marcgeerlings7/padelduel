import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { resolveForfeitDisputeSchema } from "@/lib/dispute/validation";
import { jsonError } from "@/lib/http";
import { resolveForfeitDispute, DisputeError } from "@/server/services/disputeService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  if (user.role !== "ADMIN") {
    return jsonError("Alleen toegankelijk voor admins.", 403, "forbidden");
  }

  const body = await request.json().catch(() => null);
  const parsed = resolveForfeitDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    await resolveForfeitDispute(
      params.id,
      user.id,
      parsed.data.resolution,
      parsed.data.atFaultDuoId,
      parsed.data.notes,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DisputeError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
