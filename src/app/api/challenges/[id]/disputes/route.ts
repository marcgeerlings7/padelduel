import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { openDisputeSchema } from "@/lib/dispute/validation";
import { jsonError } from "@/lib/http";
import { openForfeitDispute, DisputeError } from "@/server/services/disputeService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = openDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    const dispute = await openForfeitDispute(params.id, user.id, parsed.data.reason);
    return NextResponse.json({ id: dispute.id }, { status: 201 });
  } catch (err) {
    if (err instanceof DisputeError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
