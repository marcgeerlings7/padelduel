"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type RatingHistoryEntry = {
  id: string;
  ratingBefore: number;
  ratingAfter: number;
  kFactor: number | null;
  isForfeit: boolean;
  matchId: string | null;
  challengeId: string | null;
  createdAt: string;
};

export default function RatingHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [history, setHistory] = useState<RatingHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<RatingHistoryEntry[]>(`/api/duos/${params.id}/rating-history`)
      .then(setHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon de ratinggeschiedenis niet laden.");
      });
  }, [params.id, router]);

  if (error) {
    return <main className="px-4 py-8 sm:px-8 text-sm text-red-600 dark:text-red-400">{error}</main>;
  }
  if (!history) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Ratinggeschiedenis</h1>

      {history.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">Nog geen ratingwijzigingen.</p>
      )}

      <ul className="flex flex-col gap-2">
        {history.map((entry) => {
          const delta = entry.ratingAfter - entry.ratingBefore;
          const sign = delta >= 0 ? "+" : "";
          return (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
            >
              <div>
                <span
                  className={
                    "font-semibold " +
                    (delta >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")
                  }
                >
                  {sign}
                  {delta}
                </span>{" "}
                <span className="text-black/60 dark:text-white/60">
                  ({entry.ratingBefore} → {entry.ratingAfter})
                </span>
              </div>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs " +
                  (entry.isForfeit
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300")
                }
              >
                {entry.isForfeit ? "Forfeit-penalty" : "Wedstrijdresultaat"}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
