import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listOpenDisputes } from "@/server/services/disputeService";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const disputes = await listOpenDisputes();
  return NextResponse.json(disputes);
}
