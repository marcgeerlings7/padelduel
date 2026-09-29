import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { expireOverdueChallenges } from "@/server/services/challengeService";
import { autoConfirmOverdueMatches, expireUnplayedChallenges } from "@/server/services/matchService";
import { sendDueReminders, type ReminderRunResult } from "@/server/services/notificationService";

/**
 * Combineert alle achtergrondjobs (US-E4/US-F3/US-F5 + e-mailherinneringen) in één
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

  // Herinneringen pas NA de verloop-/bevestigingsjobs, zodat er niet
  // herinnerd wordt aan iets dat in dezelfde run al verlopen/verwerkt is.
  // Een fout hier laat de rest van de run (al gecommit) ongemoeid.
  let reminders: ReminderRunResult | { error: string };
  try {
    reminders = await sendDueReminders();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[jobs] herinneringen versturen mislukt:", err instanceof Error ? err.message : err);
    reminders = { error: "reminders_failed" };
  }

  return NextResponse.json({
    expiredChallenges: expiredChallenges.filter(Boolean).length,
    autoConfirmedMatches: autoConfirmed.filter((r) => !r.alreadyProcessed).length,
    expiredUnplayedChallenges: expiredUnplayed.filter(Boolean).length,
    reminders,
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
