import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { dissolveDuo, DuoError } from "@/server/services/duoService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  try {
    const result = await dissolveDuo(params.id, user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DuoError) {
      return jsonError(err.message, err.httpStatus, err.code);
    }
    throw err;
  }
}
