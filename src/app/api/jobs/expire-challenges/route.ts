import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { expireOverdueChallenges } from "@/server/services/challengeService";

/**
 * Achtergrondjob uit US-E4, bedoeld om periodiek aangeroepen te worden
 * door een externe scheduler (Vercel Cron, zie vercel.json). Beveiligd
 * met een gedeeld secret (zie isAuthorizedJobRequest) zodat dit geen
 * publiek aanroepbaar systeem-endpoint is.
 */
async function run() {
  const results = await expireOverdueChallenges();
  const processed = results.filter(Boolean);
  return NextResponse.json({ expiredCount: processed.length, expired: processed });
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
