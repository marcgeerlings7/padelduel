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

  let emailSent: boolean;
  try {
    ({ emailSent } = await register(parsed.data.email, parsed.data.password));
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }

  // Account is in beide gevallen aangemaakt (201). Bij een mislukte
  // verzending krijgt de client dat expliciet te horen (emailSent: false),
  // zodat de UI naar "activatielink opnieuw versturen" kan verwijzen.
  return NextResponse.json(
    {
      message: emailSent
        ? "Account aangemaakt. Controleer je e-mail om te activeren."
        : "Account aangemaakt, maar de activatiemail kon niet worden verstuurd. Vraag hieronder een nieuwe activatielink aan.",
      emailSent,
    },
    { status: 201 },
  );
}
