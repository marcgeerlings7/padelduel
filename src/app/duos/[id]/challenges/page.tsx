"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type ChallengeDuo = { id: string; name: string };
type MatchSummary = {
  id: string;
  status: string;
  scoreRaw: string;
  submittedBy: string;
};
type Challenge = {
  id: string;
  status: string;
  challengerDuoId: string;
  challengedDuoId: string;
  challengerDuo: ChallengeDuo;
  challengedDuo: ChallengeDuo;
  responseDeadline: string;
  matchDeadline: string | null;
  match: MatchSummary | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Geweigerd",
  EXPIRED: "Verlopen",
  COMPLETED: "Voltooid",
  UNPLAYED_TIMEOUT: "Niet gespeeld (forfeit)",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  AWAITING_CONFIRMATION: "Wacht op bevestiging",
  COMPLETED: "Bevestigd",
  DISPUTED: "Betwist — wordt beoordeeld",
  VOIDED: "Ongeldig verklaard",
};

type SetInput = { challengerGames: string; challengedGames: string };

function ScoreForm({ challengeId, onSubmitted }: { challengeId: string; onSubmitted: () => void }) {
  const [sets, setSets] = useState<SetInput[]>([
    { challengerGames: "", challengedGames: "" },
    { challengerGames: "", challengedGames: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateSet(index: number, field: keyof SetInput, value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsedSets = sets.map((s) => ({
        challengerGames: Number(s.challengerGames),
        challengedGames: Number(s.challengedGames),
      }));
      await apiFetch(`/api/challenges/${challengeId}/score`, {
        method: "POST",
        body: JSON.stringify({ sets: parsedSets, idempotencyKey: crypto.randomUUID() }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 text-sm">
      {sets.map((set, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-12 text-black/60 dark:text-white/60">Set {i + 1}</span>
          <input
            type="number"
            min={0}
            required
            value={set.challengerGames}
            onChange={(e) => updateSet(i, "challengerGames", e.target.value)}
            className="w-16 rounded-md border border-black/20 px-2 py-1 dark:border-white/30 dark:bg-transparent"
            placeholder="uitd."
          />
          <span>-</span>
          <input
            type="number"
            min={0}
            required
            value={set.challengedGames}
            onChange={(e) => updateSet(i, "challengedGames", e.target.value)}
            className="w-16 rounded-md border border-black/20 px-2 py-1 dark:border-white/30 dark:bg-transparent"
            placeholder="uitg."
          />
        </div>
      ))}
      <div className="flex gap-2">
        {sets.length < 3 && (
          <button
            type="button"
            onClick={() => setSets((prev) => [...prev, { challengerGames: "", challengedGames: "" }])}
            className="rounded-md border border-black/20 px-2 py-1 text-xs dark:border-white/30"
          >
            + 3e set
          </button>
        )}
        {sets.length > 2 && (
          <button
            type="button"
            onClick={() => setSets((prev) => prev.slice(0, -1))}
            className="rounded-md border border-black/20 px-2 py-1 text-xs dark:border-white/30"
          >
            − 3e set
          </button>
        )}
      </div>
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Score indienen
      </button>
    </form>
  );
}

export default function DuoChallengesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

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

  async function respondToMatch(matchId: string, decision: "confirm" | "dispute") {
    setBusyId(matchId);
    setMatchError(null);
    try {
      await apiFetch(`/api/matches/${matchId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      reload();
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
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

      {matchError && <p className="text-sm text-red-600 dark:text-red-400">{matchError}</p>}

      <ul className="flex flex-col gap-2">
        {challenges.map((c) => {
          const isChallengedDuo = c.challengedDuoId === params.id;
          const opponent = isChallengedDuo ? c.challengerDuo : c.challengedDuo;
          const canRespond = isChallengedDuo && c.status === "PENDING";
          const canSubmitScore = c.status === "ACCEPTED" && !c.match;
          const matchAwaitingConfirmation = c.match?.status === "AWAITING_CONFIRMATION";

          return (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">vs. {opponent.name}</p>
                  <p className="text-black/60 dark:text-white/60">
                    {STATUS_LABELS[c.status] ?? c.status}
                    {c.status === "PENDING" &&
                      ` · reageren vóór ${new Date(c.responseDeadline).toLocaleDateString("nl-NL")}`}
                    {c.status === "ACCEPTED" &&
                      c.matchDeadline &&
                      ` · speeltermijn tot ${new Date(c.matchDeadline).toLocaleDateString("nl-NL")}`}
                    {c.match && ` · score ${c.match.scoreRaw} (${MATCH_STATUS_LABELS[c.match.status] ?? c.match.status})`}
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
                {matchAwaitingConfirmation && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === c.match!.id}
                      onClick={() => respondToMatch(c.match!.id, "confirm")}
                      className="rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                      Bevestigen
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.match!.id}
                      onClick={() => respondToMatch(c.match!.id, "dispute")}
                      className="rounded-md border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/30"
                    >
                      Betwisten
                    </button>
                  </div>
                )}
              </div>

              {canSubmitScore && <ScoreForm challengeId={c.id} onSubmitted={reload} />}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
