import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/validation";
import { jsonError, getClientIp } from "@/lib/http";
import { login, AuthError } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  const rateLimitKey = `${parsed.data.email}::${getClientIp(request)}`;

  try {
    const { token } = await login(parsed.data.email, parsed.data.password, rateLimitKey);
    return NextResponse.json({ token });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
