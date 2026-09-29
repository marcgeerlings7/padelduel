"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/client/api";
import { NOTIFICATION_PREFERENCE_KEYS } from "@/lib/notifications/preferences";
import type { NotificationPreferenceKey, NotificationPreferencesResponse } from "./types";

/**
 * Zes schakelaars voor e-mailmeldingen (GET/PATCH
 * /api/me/notification-preferences). Elke wijziging wordt direct
 * opgeslagen (optimistisch; bij een fout terug naar de vorige stand). De
 * labels komen van de server.
 */
export function NotificationPreferencesCard() {
  const id = useId();
  const [data, setData] = useState<NotificationPreferencesResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<NotificationPreferenceKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    apiFetch<NotificationPreferencesResponse>("/api/me/notification-preferences")
      .then((response) => !cancelled && setData(response))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function toggle(key: NotificationPreferenceKey, value: boolean) {
    if (!data) return;
    const previous = data.preferences[key];
    setData({ ...data, preferences: { ...data.preferences, [key]: value } });
    setSaving(key);
    try {
      const response = await apiFetch<NotificationPreferencesResponse>("/api/me/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setData(response);
      toast.success(value ? "E-mailmelding aangezet" : "E-mailmelding uitgezet", { id: "notification-preference" });
    } catch {
      setData((current) => (current ? { ...current, preferences: { ...current.preferences, [key]: previous } } : current));
      toast.error("Je voorkeur kon niet worden opgeslagen. Probeer het opnieuw.", { id: "notification-preference" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <SectionCard
      id="profiel-meldingen"
      title="E-mailmeldingen"
      description="Kies waarover we je mailen. Je wijziging wordt meteen opgeslagen."
      flush
    >
      {loadError ? (
        <div role="alert" className="mx-4 mb-4 flex flex-col items-start gap-3 rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss sm:mx-5 sm:mb-5">
          <p>Kon je e-mailvoorkeuren niet laden.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Opnieuw proberen
          </Button>
        </div>
      ) : !data ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <ListSkeleton rows={6} label="E-mailvoorkeuren laden…" />
        </div>
      ) : (
        <ul className="flex flex-col">
          {NOTIFICATION_PREFERENCE_KEYS.map((key) => {
            const switchId = `${id}-${key}`;
            return (
              <li key={key} className="flex items-center justify-between gap-4 border-t px-4 py-3 sm:px-5">
                <Label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer py-1 leading-snug font-normal">
                  {data.labels[key]}
                </Label>
                <Switch
                  id={switchId}
                  checked={data.preferences[key]}
                  disabled={saving === key}
                  onCheckedChange={(value) => toggle(key, value)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
