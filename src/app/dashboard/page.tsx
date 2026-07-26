"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type NearbyEntry = { id: string; name: string; currentRating: number; position: number };
type DashboardDuoCard = {
  duo: {
    id: string;
    name: string;
    regionName: string;
    currentRating: number;
    position: number;
    ladderSize: number;
  };
  above: NearbyEntry[];
  below: NearbyEntry[];
};
type DashboardData = {
  duos: DashboardDuoCard[];
  activeDuoCount: number;
  maxActiveDuos: number;
  canFormMoreDuos: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon het dashboard niet laden.");
      });
  }, [router]);

  if (error) {
    return <main className="px-4 py-8 sm:px-8 text-sm text-red-600 dark:text-red-400">{error}</main>;
  }
  if (!data) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Mijn dashboard</h1>

      {data.duos.length === 0 && (
        <div className="rounded-md border border-black/10 p-4 text-sm dark:border-white/20">
          <p className="mb-3">Je bent nog geen lid van een actief duo.</p>
          <Link
            href="/duos/propose"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Vorm een duo
          </Link>
        </div>
      )}

      {data.duos.map((card) => (
        <section
          key={card.duo.id}
          className="rounded-md border border-black/10 p-4 dark:border-white/20"
        >
          <h2 className="font-semibold">{card.duo.name}</h2>
          <p className="text-sm text-black/70 dark:text-white/70">
            {card.duo.regionName} · rating {card.duo.currentRating} · positie {card.duo.position}/
            {card.duo.ladderSize}
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-black/50 dark:text-white/50">
                Boven jou
              </p>
              <ul className="text-sm">
                {card.above.length === 0 && <li className="text-black/40 dark:text-white/40">—</li>}
                {card.above.map((entry) => (
                  <li key={entry.id}>
                    #{entry.position} {entry.name} ({entry.currentRating})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-black/50 dark:text-white/50">
                Onder jou
              </p>
              <ul className="text-sm">
                {card.below.length === 0 && <li className="text-black/40 dark:text-white/40">—</li>}
                {card.below.map((entry) => (
                  <li key={entry.id}>
                    #{entry.position} {entry.name} ({entry.currentRating})
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href={`/duos/${card.duo.id}/challenges`}
            className="mt-3 inline-block text-sm underline"
          >
            Challenges bekijken
          </Link>
        </section>
      ))}

      {data.duos.length > 0 && data.canFormMoreDuos && (
        <Link
          href="/duos/propose"
          className="self-start rounded-md border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/30"
        >
          + Nieuw duo vormen ({data.activeDuoCount}/{data.maxActiveDuos})
        </Link>
      )}

      <Link href="/duos/invitations" className="text-sm underline">
        Mijn uitnodigingen bekijken
      </Link>
    </main>
  );
}
