import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { expireOverdueChallenges } from "@/server/services/challengeService";
import { autoConfirmOverdueMatches, expireUnplayedChallenges } from "@/server/services/matchService";

/**
 * Combineert alle drie de achtergrondjobs (US-E4/US-F3/US-F5) in één
 * aanroep, zodat één enkele Vercel Cron-trigger (zie vercel.json)
 * volstaat — het Hobby-plan staat maximaal 2 cron jobs toe. De losse
 * endpoints (/api/jobs/expire-challenges e.a.) blijven bestaan voor
 * handmatige/gerichte aanroepen.
 */
async function run() {
  const [expiredChallenges, autoConfirmed, expiredUnplayed] = await Promise.all([
    expireOverdueChallenges(),
    autoConfirmOverdueMatches(),
    expireUnplayedChallenges(),
  ]);

  return NextResponse.json({
    expiredChallenges: expiredChallenges.filter(Boolean).length,
    autoConfirmedMatches: autoConfirmed.filter((r) => !r.alreadyProcessed).length,
    expiredUnplayedChallenges: expiredUnplayed.filter(Boolean).length,
  });
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
