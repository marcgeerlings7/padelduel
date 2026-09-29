"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { CardSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { MyProfileResponse } from "@/components/profile/types";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    setError(null);
    apiFetch<MyProfileResponse>("/api/me/profile")
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon je profiel niet laden.");
      });
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  return (
    <Page>
      <PageHeader title="Profiel" description="Hoe andere spelers je zien, en welke e-mails je van ons krijgt." />

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Opnieuw proberen
          </Button>
        </div>
      ) : null}

      {!profile && !error ? (
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={2} label="Profiel laden…" />
          <CardSkeleton lines={4} />
        </div>
      ) : null}

      {profile ? (
        <>
          <IdentityCard profile={profile} />
          <ProfileForm key={profile.id} profile={profile} onSaved={setProfile} />
          <NotificationPreferencesCard />
        </>
      ) : null}
    </Page>
  );
}

/** Court-vlak: de publieke naam zoals anderen hem zien, plus het (privé) e-mailadres. */
function IdentityCard({ profile }: { profile: MyProfileResponse }) {
  return (
    <section
      aria-label="Zo zien andere spelers je"
      className="court-lines relative flex items-center gap-4 overflow-hidden rounded-2xl bg-court p-5 text-court-foreground shadow-raised"
    >
      <DuoAvatar name={profile.publicName} size="lg" className="ring-2 ring-white/25" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-semibold text-court-muted">Zo zien andere spelers je</p>
        <p className="truncate font-display text-[1.75rem] leading-none font-bold">{profile.publicName}</p>
        <p className="truncate text-sm text-court-muted">
          <span className="sr-only">E-mailadres, alleen voor jou zichtbaar: </span>
          {profile.email}
        </p>
      </div>
      {!profile.hasDisplayName ? (
        <span className="absolute top-3 right-3 rounded-full bg-ball px-2 py-0.5 text-xs font-semibold text-ball-foreground">
          Nog geen naam
        </span>
      ) : null}
    </section>
  );
}
