import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createAvailabilitySchema } from "@/lib/availability/validation";
import { jsonError } from "@/lib/http";
import {
  listAvailability,
  addAvailability,
  AvailabilityError,
} from "@/server/services/availabilityService";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("Niet ingelogd.", 401, "unauthorized");

  try {
    const blocks = await listAvailability(params.id, user.id);
    return NextResponse.json(blocks);
  } catch (err) {
    if (err instanceof AvailabilityError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("Niet ingelogd.", 401, "unauthorized");

  const body = await request.json().catch(() => null);
  const parsed = createAvailabilitySchema.safeParse(body);
  if (!parsed.success) return jsonError("Ongeldige invoer.", 400, "invalid_input");

  try {
    const block = await addAvailability(params.id, user.id, parsed.data);
    return NextResponse.json(block, { status: 201 });
  } catch (err) {
    if (err instanceof AvailabilityError) return jsonError(err.message, err.httpStatus, err.code);
    throw err;
  }
}
