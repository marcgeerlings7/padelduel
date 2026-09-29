import type { NotificationPreferenceKey, NotificationPreferences } from "@/lib/notifications/preferences";
import type { MyProfile } from "@/server/services/profileService";

/** Response van GET/PATCH /api/me/profile. */
export type MyProfileResponse = MyProfile;

/** Response van GET/PATCH /api/me/notification-preferences. */
export type NotificationPreferencesResponse = {
  preferences: NotificationPreferences;
  labels: Record<NotificationPreferenceKey, string>;
};

export type { NotificationPreferenceKey };

/** Speelsterkte-keuzes (1 = sterkst, 9 = beginner). */
export const KNLTB_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
