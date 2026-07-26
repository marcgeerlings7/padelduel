import { NextRequest } from "next/server";
import { verifySessionToken } from "./tokens";

export type AuthenticatedUser = { id: string; role: "USER" | "ADMIN" };

export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length);
  const result = await verifySessionToken(token);
  if (!result.ok) {
    return null;
  }
  return { id: result.payload.sub, role: result.payload.role };
}
