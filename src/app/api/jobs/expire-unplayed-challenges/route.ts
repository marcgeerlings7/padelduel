import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { expireUnplayedChallenges } from "@/server/services/matchService";

/** Simuleert de achtergrondjob uit US-F5. Zie /api/jobs/expire-challenges voor de beveiligingsaanpak. */
async function run() {
  const results = await expireUnplayedChallenges();
  const processed = results.filter(Boolean);
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
