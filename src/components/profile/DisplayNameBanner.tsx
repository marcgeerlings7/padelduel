"use client";

import { UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/api";
import type { MyProfileResponse } from "./types";

const DISMISS_KEY = "padel_ladder_name_prompt_dismissed";

function readDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === userId;
  } catch {
    return false;
  }
}

function writeDismissed(userId: string) {
  try {
    window.localStorage.setItem(DISMISS_KEY, userId);
  } catch {
    // Opslag geblokkeerd (privévenster): de banner verdwijnt dan alleen voor deze pagina.
  }
}

/**
 * Vraagt spelers zonder weergavenaam (accounts van vóór de verplichte naam
 * bij registratie) er een in te stellen. Wegklikbaar; dat wordt per
 * gebruiker in deze browser onthouden. Verschijnt niet als het profiel niet
 * geladen kan worden.
 */
export function DisplayNameBanner() {
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MyProfileResponse>("/api/me/profile")
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setDismissed(readDismissed(data.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile || profile.hasDisplayName || dismissed) return null;

  return (
    <aside
      aria-labelledby="name-prompt-title"
      className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-sm"
    >
      <UserRound aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p id="name-prompt-title" className="font-semibold text-foreground">
            Stel je naam in
          </p>
          <p className="text-muted-foreground">
            Andere spelers zien je nu als &ldquo;{profile.publicName}&rdquo;. Met je naam herkennen je partner en
            tegenstanders je sneller.
          </p>
        </div>
        <Button asChild size="sm" className="w-fit">
          <Link href="/profile">Naam instellen</Link>
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Melding sluiten"
        className="-mt-1 -mr-2 shrink-0"
        onClick={() => {
          writeDismissed(profile.id);
          setDismissed(true);
        }}
      >
        <X aria-hidden />
      </Button>
    </aside>
  );
}
