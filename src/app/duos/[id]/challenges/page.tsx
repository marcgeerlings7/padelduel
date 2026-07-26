"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type ChallengeDuo = { id: string; name: string };
type Challenge = {
  id: string;
  status: string;
  challengerDuoId: string;
  challengedDuoId: string;
  challengerDuo: ChallengeDuo;
  challengedDuo: ChallengeDuo;
  responseDeadline: string;
  matchDeadline: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Geweigerd",
  EXPIRED: "Verlopen",
  COMPLETED: "Voltooid",
  UNPLAYED_TIMEOUT: "Niet gespeeld (forfeit)",
};

export default function DuoChallengesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    apiFetch<Challenge[]>(`/api/duos/${params.id}/challenges`)
      .then(setChallenges)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon de challenges niet laden.");
      });
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router]);

  async function respond(challengeId: string, decision: "accept" | "decline") {
    setBusyId(challengeId);
    try {
      await apiFetch(`/api/challenges/${challengeId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <main className="px-4 py-8 sm:px-8 text-sm text-red-600 dark:text-red-400">{error}</main>;
  }
  if (!challenges) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Challenges</h1>

      {challenges.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">Nog geen challenges.</p>
      )}

      <ul className="flex flex-col gap-2">
        {challenges.map((c) => {
          const isChallengedDuo = c.challengedDuoId === params.id;
          const opponent = isChallengedDuo ? c.challengerDuo : c.challengedDuo;
          const canRespond = isChallengedDuo && c.status === "PENDING";
          return (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">vs. {opponent.name}</p>
                <p className="text-black/60 dark:text-white/60">
                  {STATUS_LABELS[c.status] ?? c.status}
                  {c.status === "PENDING" &&
                    ` · reageren vóór ${new Date(c.responseDeadline).toLocaleDateString("nl-NL")}`}
                  {c.status === "ACCEPTED" &&
                    c.matchDeadline &&
                    ` · speeltermijn tot ${new Date(c.matchDeadline).toLocaleDateString("nl-NL")}`}
                </p>
              </div>
              {canRespond && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => respond(c.id, "accept")}
                    className="rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Accepteren
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => respond(c.id, "decline")}
                    className="rounded-md border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/30"
                  >
                    Weigeren
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
