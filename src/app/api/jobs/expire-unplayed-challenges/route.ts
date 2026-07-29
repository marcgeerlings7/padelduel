import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { expireUnplayedChallenges } from "@/server/services/matchService";

/** Simuleert de achtergrondjob uit US-F5. Zie /api/jobs/expire-challenges voor de beveiligingsaanpak. */
export async function POST(request: NextRequest) {
  const secret = process.env.JOBS_SECRET;
  const provided = request.headers.get("x-job-secret");
  if (!secret || provided !== secret) {
    return jsonError("Niet geautoriseerd.", 401, "unauthorized");
  }

  const results = await expireUnplayedChallenges();
  const processed = results.filter(Boolean);
  return NextResponse.json({ processedCount: processed.length, processed });
}
