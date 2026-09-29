"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

/**
 * Vorm van GET /api/duos/mine (duoService.listMyDuos): duo + regio en de
 * afgeleide tier/ladderpositie. `tierSize` komt uit platform_config, zodat
 * grafieken tier-grenzen kunnen tekenen zonder de hele ladder op te halen.
 */
export type MyDuo = {
  id: string;
  name: string;
  regionId: string;
  currentRating: number;
  tier: number;
  tierSize: number;
  /** Afgeleide ladderpositie in de eigen regio (null in een randgeval). */
  position: number | null;
  ladderSize: number;
  category: "HEREN" | "DAMES" | "GEMENGD" | null;
  region: { id: string; name: string; slug: string };
};

/**
 * Eigen actieve duo's van de ingelogde gebruiker. Stuurt naar /login zonder
 * sessie. `selectedId` is de keuze op de algemene pagina's (/challenges,
 * /rating-history, /availability); standaard het eerste duo.
 */
export function useMyDuos() {
  const router = useRouter();
  const [duos, setDuos] = useState<MyDuo[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    apiFetch<MyDuo[]>("/api/duos/mine")
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
        setError("Kon je duo's niet laden.");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { duos, selectedId, setSelectedId, error };
}
