import { NextRequest } from "next/server";

/**
 * Twee geldige manieren om een job-endpoint aan te roepen, beide tegen
 * hetzelfde gedeelde secret (JOBS_SECRET):
 * - `x-job-secret`-header (handmatig/extern, POST) — de oorspronkelijke aanpak.
 * - `Authorization: Bearer <secret>` (GET) — het formaat waarmee Vercel
 *   Cron automatisch een `CRON_SECRET`-omgevingsvariabele meestuurt, zie
 *   vercel.json. We hergebruiken bewust dezelfde JOBS_SECRET-waarde i.p.v.
 *   een tweede secret te introduceren.
 */
export function isAuthorizedJobRequest(request: NextRequest): boolean {
  const secret = process.env.JOBS_SECRET;
  if (!secret) return false;

  const jobHeader = request.headers.get("x-job-secret");
  if (jobHeader === secret) return true;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
