"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

/** Vorm van GET /api/duos/mine (listMyDuos: duo + regio + afgeleide tier). */
export type OwnDuo = {
  id: string;
  name: string;
  regionId: string;
  currentRating: number;
  tier: number;
  region: { id: string; name: string; slug: string };
};

/**
 * Eigen actieve duo's van de ingelogde gebruiker. Stuurt naar /login zonder
 * sessie. `selectedId` is de keuze op de algemene pagina's (/challenges,
 * /rating-history); standaard het eerste duo.
 */
export function useOwnDuos() {
  const router = useRouter();
  const [duos, setDuos] = useState<OwnDuo[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    apiFetch<OwnDuo[]>("/api/duos/mine")
      .then((data) => {
        if (cancelled) return;
        setDuos(data);
        setSelectedId((current) => current || data[0]?.id || "");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon je duo's niet laden. Ververs de pagina om het opnieuw te proberen.");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { duos, selectedId, setSelectedId, error };
}

/**
 * User-id uit het (ongeverifieerde) sessie-JWT — alleen als UI-hint (bijv.
 * "jij hebt deze score ingediend"). Autorisatie blijft altijd server-side.
 */
export function getStoredUserId(): string | null {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
