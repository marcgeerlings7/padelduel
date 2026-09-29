import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  NOTIFICATION_PREFERENCE_LABELS,
  updateNotificationPreferencesSchema,
} from "@/lib/notifications/preferences";
import { jsonError } from "@/lib/http";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/server/services/notificationService";

/** { preferences: Record<key, boolean>, labels: Record<key, string> } */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }
  const preferences = await getNotificationPreferences(user.id);
  return NextResponse.json({ preferences, labels: NOTIFICATION_PREFERENCE_LABELS });
}

/** Gedeeltelijke update: alleen meegegeven keys wijzigen. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const body = await request.json().catch(() => null);
  const parsed = updateNotificationPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ongeldige invoer.", 400, "invalid_input");
  }

  const preferences = await updateNotificationPreferences(user.id, parsed.data);
  return NextResponse.json({ preferences, labels: NOTIFICATION_PREFERENCE_LABELS });
}
