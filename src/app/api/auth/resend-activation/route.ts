import { NextRequest, NextResponse } from "next/server";
import { resendActivationSchema } from "@/lib/auth/validation";
import { jsonError } from "@/lib/http";
import { resendActivation } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resendActivationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  const message = await resendActivation(parsed.data.email);
  return NextResponse.json({ message });
}
