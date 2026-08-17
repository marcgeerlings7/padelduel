import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { autoConfirmOverdueMatches } from "@/server/services/matchService";

/** Simuleert de achtergrondjob uit US-F3. Zie /api/jobs/expire-challenges voor de beveiligingsaanpak. */
async function run() {
  const results = await autoConfirmOverdueMatches();
  const processed = results.filter((r) => !r.alreadyProcessed);
  return NextResponse.json({ processedCount: processed.length, processed });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return jsonError("Niet geautoriseerd.", 401, "unauthorized");
  }
  return run();
}

/** Vercel Cron roept jobs aan via GET met een Authorization: Bearer-header. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return jsonError("Niet geautoriseerd.", 401, "unauthorized");
  }
  return run();
}
