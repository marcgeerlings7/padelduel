import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { expireOverdueChallenges } from "@/server/services/challengeService";

/**
 * Simuleert de achtergrondjob uit US-E4: bedoeld om periodiek aangeroepen
 * te worden door een externe scheduler (bijv. Vercel Cron). Beveiligd met
 * een gedeeld secret zodat dit geen publiek aanroepbaar systeem-endpoint is.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.JOBS_SECRET;
  const provided = request.headers.get("x-job-secret");
  if (!secret || provided !== secret) {
    return jsonError("Niet geautoriseerd.", 401, "unauthorized");
  }

  const results = await expireOverdueChallenges();
  const processed = results.filter(Boolean);
  return NextResponse.json({ expiredCount: processed.length, expired: processed });
}
