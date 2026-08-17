"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type ChallengeDuo = { id: string; name: string };
type DisputeSummary = { id: string; status: string };
type MatchSummary = {
  id: string;
  status: string;
  scoreRaw: string;
  submittedBy: string;
  dispute: DisputeSummary | null;
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
  dispute: DisputeSummary | null;
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
    <form onSubmit={handleSubmit} style={{ marginTop: 16, maxWidth: 420 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 12,
          textTransform: "uppercase",
        }}
      >
        <div>Uitdager</div>
        <div />
        <div style={{ textAlign: "right" }}>Uitgedaagde</div>
      </div>
      {sets.map((set, i) => (
        <div
          key={i}
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 12 }}
        >
          <input
            className="input"
            type="number"
            min={0}
            required
            value={set.challengerGames}
            onChange={(e) => updateSet(i, "challengerGames", e.target.value)}
            placeholder="0"
          />
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)", textAlign: "center" }}>set {i + 1}</div>
          <input
            className="input"
            type="number"
            min={0}
            required
            value={set.challengedGames}
            onChange={(e) => updateSet(i, "challengedGames", e.target.value)}
            placeholder="0"
          />
        </div>
      ))}
      <div className="flex gap-2" style={{ marginBottom: 8 }}>
        {sets.length < 3 && (
          <button
            type="button"
            onClick={() => setSets((prev) => [...prev, { challengerGames: "", challengedGames: "" }])}
            className="btn btn-secondary"
            style={{ fontSize: 11 }}
          >
            + 3e set
          </button>
        )}
        {sets.length > 2 && (
          <button
            type="button"
            onClick={() => setSets((prev) => prev.slice(0, -1))}
            className="btn btn-secondary"
            style={{ fontSize: 11 }}
          >
            − 3e set
          </button>
        )}
      </div>
      {error && <p style={{ color: "var(--color-accent-700)" }}>{error}</p>}
      <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Score indienen
      </button>
    </form>
  );
}

function DisputeForm({
  submitPath,
  onSubmitted,
}: {
  submitPath: string;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(submitPath, { method: "POST", body: JSON.stringify({ reason }) });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" style={{ marginTop: 8, fontSize: 13 }}>
      <textarea
        className="input"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Waarom betwist je dit?"
      />
      {error && <p style={{ color: "var(--color-accent-700)" }}>{error}</p>}
      <button type="submit" disabled={submitting} className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
        Dispute openen
      </button>
    </form>
  );
}

export function DuoChallengesView({ duoId }: { duoId: string }) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  function reload() {
    apiFetch<Challenge[]>(`/api/duos/${duoId}/challenges`)
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
    setChallenges(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duoId, router]);

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
    return <p style={{ fontSize: 14, color: "var(--color-accent-700)" }}>{error}</p>;
  }
  if (!challenges) {
    return <p className="text-sm">Laden...</p>;
  }

  return (
    <>
      {challenges.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Nog geen challenges.</p>}

      {matchError && <p style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{matchError}</p>}

      <ul>
        {challenges.map((c) => {
          const isChallengedDuo = c.challengedDuoId === duoId;
          const opponent = isChallengedDuo ? c.challengerDuo : c.challengedDuo;
          const canRespond = isChallengedDuo && c.status === "PENDING";
          const canSubmitScore = c.status === "ACCEPTED" && !c.match;
          const matchAwaitingConfirmation = c.match?.status === "AWAITING_CONFIRMATION";
          const canOpenMatchDispute = c.match?.status === "DISPUTED" && !c.match.dispute;
          const canOpenForfeitDispute = c.status === "UNPLAYED_TIMEOUT" && !c.dispute;
          const statusTagClass = c.status === "PENDING" || matchAwaitingConfirmation ? "tag-accent" : "tag-outline";

          return (
            <li
              key={c.id}
              style={{
                padding: "16px 0",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>vs. {opponent.name}</p>
                  <p style={{ color: "var(--color-neutral-700)", margin: 0, fontSize: 13 }}>
                    {c.status === "PENDING" &&
                      `Deadline: ${new Date(c.responseDeadline).toLocaleDateString("nl-NL")}`}
                    {c.status === "ACCEPTED" &&
                      c.matchDeadline &&
                      `Deadline: ${new Date(c.matchDeadline).toLocaleDateString("nl-NL")}`}
                    {c.match && `score ${c.match.scoreRaw} · ${MATCH_STATUS_LABELS[c.match.status] ?? c.match.status}`}
                    {" · "}
                    {isChallengedDuo ? "Inkomend" : "Uitgaand"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`tag ${statusTagClass}`}>{STATUS_LABELS[c.status] ?? c.status}</span>
                  {canRespond && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => respond(c.id, "accept")}
                        className="btn btn-primary"
                      >
                        Accepteren
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => respond(c.id, "decline")}
                        className="btn btn-secondary"
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
                        className="btn btn-primary"
                      >
                        Bevestigen
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.match!.id}
                        onClick={() => respondToMatch(c.match!.id, "dispute")}
                        className="btn btn-secondary"
                      >
                        Betwisten
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {canSubmitScore && <ScoreForm challengeId={c.id} onSubmitted={reload} />}
              {canOpenMatchDispute && (
                <DisputeForm submitPath={`/api/matches/${c.match!.id}/disputes`} onSubmitted={reload} />
              )}
              {c.match?.dispute && (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Dispute geopend — wordt beoordeeld door een admin.
                </p>
              )}
              {canOpenForfeitDispute && (
                <DisputeForm submitPath={`/api/challenges/${c.id}/disputes`} onSubmitted={reload} />
              )}
              {c.dispute && (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Forfeit-dispute geopend — wordt beoordeeld door een admin.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
