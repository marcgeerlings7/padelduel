import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { updateAvailabilitySchema } from "@/lib/availability/validation";
import { jsonError } from "@/lib/http";
import {
  updateAvailability,
  deleteAvailability,
  AvailabilityError,
} from "@/server/services/availabilityService";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("Niet ingelogd.", 401, "unauthorized");

  const body = await request.json().catch(() => null);
  const parsed = updateAvailabilitySchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    const block = await updateAvailability(params.id, user.id, parsed.data);
    return NextResponse.json(block);
  } catch (err) {
    if (err instanceof AvailabilityError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("Niet ingelogd.", 401, "unauthorized");

  try {
    await deleteAvailability(params.id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AvailabilityError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
