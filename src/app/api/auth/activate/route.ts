import { NextRequest, NextResponse } from "next/server";
import { activateSchema } from "@/lib/auth/validation";
import { jsonError } from "@/lib/http";
import { activate, AuthError } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    await activate(parsed.data.token);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }

  return NextResponse.json({ message: "Account geactiveerd. Je kunt nu inloggen." });
}
