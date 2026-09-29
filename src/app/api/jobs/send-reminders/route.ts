import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/auth/jobAuth";
import { sendDueReminders } from "@/server/services/notificationService";

/**
 * Deadline-herinneringen per e-mail (KNLTB-aanvullingen). Draait ook
 * automatisch mee in /api/jobs/run-all; dit endpoint is voor handmatige/
 * gerichte aanroepen. Idempotent via notification_log.
 */
async function run() {
  return NextResponse.json(await sendDueReminders());
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
