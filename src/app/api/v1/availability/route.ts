import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import {
  authenticateApiKey,
  enforceRateLimit,
  getPublicAvailability,
  logApiCall,
  ExternalApiError,
} from "@/server/services/externalAvailabilityService";

/**
 * Externe, read-only availability-API (FR-8.3–8.6). Geeft NOOIT
 * persoonsgegevens terug — alleen duo-naam, regio en tijdsblokken.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return jsonError("Ontbrekende API-key (header x-api-key).", 401, "missing_api_key");
  }

  let client;
  try {
    client = await authenticateApiKey(apiKey);
    await enforceRateLimit(client.id);
  } catch (err) {
    if (err instanceof ExternalApiError) {
      const response = jsonError(err.message, err.httpStatus, err.code);
      if (err.retryAfterSeconds) {
        response.headers.set("Retry-After", String(err.retryAfterSeconds));
      }
      return response;
    }
    throw err;
  }

  const regionSlug = request.nextUrl.searchParams.get("region") ?? undefined;
  const dayOfWeekParam = request.nextUrl.searchParams.get("dayOfWeek");
  // Strikt één cijfer 0–6: `Number("")` zou anders stilletjes 0 (zondag) opleveren.
  if (dayOfWeekParam !== null && !/^[0-6]$/.test(dayOfWeekParam)) {
    await logApiCall(client.id, "/api/v1/availability", 400);
    return jsonError("dayOfWeek moet een geheel getal tussen 0 en 6 zijn.", 400, "invalid_input");
  }
  const dayOfWeek = dayOfWeekParam !== null ? Number(dayOfWeekParam) : undefined;

  const availability = await getPublicAvailability(client, { regionSlug, dayOfWeek });
  await logApiCall(client.id, "/api/v1/availability", 200);

  return NextResponse.json({ availability });
}
