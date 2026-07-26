import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/auth/validation";
import { jsonError } from "@/lib/http";
import { register, AuthError } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  try {
    await register(parsed.data.email, parsed.data.password);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }

  return NextResponse.json(
    { message: "Account aangemaakt. Controleer je e-mail om te activeren." },
    { status: 201 },
  );
}
