"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Duo = { id: string; name: string };
type Dispute = {
  id: string;
  subject: "MATCH_SCORE" | "FORFEIT";
  reason: string;
  createdAt: string;
  raisedByUser: { email: string };
  match: { id: string; scoreRaw: string; challenge: { challengerDuo: Duo; challengedDuo: Duo } } | null;
  challenge: { id: string; challengerDuo: Duo; challengedDuo: Duo } | null;
};

export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [atFaultChoice, setAtFaultChoice] = useState<Record<string, string>>({});

  function reload() {
    apiFetch<Dispute[]>("/api/admin/disputes")
      .then(setDisputes)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de disputes niet laden.");
      });
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
  }, [router]);

  async function resolveMatchScore(disputeId: string, resolution: "upheld" | "overturned") {
    setBusyId(disputeId);
    try {
      await apiFetch(`/api/admin/disputes/${disputeId}/resolve-match-score`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function resolveForfeit(disputeId: string, resolution: "upheld" | "overturned") {
    setBusyId(disputeId);
    try {
      await apiFetch(`/api/admin/disputes/${disputeId}/resolve-forfeit`, {
        method: "POST",
        body: JSON.stringify({
          resolution,
          atFaultDuoId: resolution === "overturned" ? atFaultChoice[disputeId] : undefined,
        }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <main className="px-4 py-8 sm:px-8 text-sm text-red-600 dark:text-red-400">{error}</main>;
  }
  if (!disputes) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Openstaande disputes</h1>

      {disputes.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">Geen openstaande disputes.</p>
      )}

      <ul className="flex flex-col gap-3">
        {disputes.map((d) => {
          const duos = d.match?.challenge.challengerDuo
            ? [d.match.challenge.challengerDuo, d.match.challenge.challengedDuo]
            : d.challenge
              ? [d.challenge.challengerDuo, d.challenge.challengedDuo]
              : [];

          return (
            <li key={d.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/20">
              <p className="font-medium">
                {d.subject === "MATCH_SCORE" ? "Score-dispute" : "Forfeit-dispute"}: {duos[0]?.name} vs.{" "}
                {duos[1]?.name}
              </p>
              {d.match && <p className="text-black/60 dark:text-white/60">Ingediende score: {d.match.scoreRaw}</p>}
              <p className="text-black/60 dark:text-white/60">
                Reden ({d.raisedByUser.email}): {d.reason}
              </p>

              {d.subject === "MATCH_SCORE" && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveMatchScore(d.id, "upheld")}
                    className="rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Score handhaven
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveMatchScore(d.id, "overturned")}
                    className="rounded-md border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/30"
                  >
                    Match ongeldig verklaren
                  </button>
                </div>
              )}

              {d.subject === "FORFEIT" && (
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveForfeit(d.id, "upheld")}
                    className="self-start rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Penalty bij beide handhaven
                  </button>
                  <div className="flex items-center gap-2">
                    <select
                      value={atFaultChoice[d.id] ?? ""}
                      onChange={(e) => setAtFaultChoice((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      className="rounded-md border border-black/20 px-2 py-1 dark:border-white/30 dark:bg-transparent"
                    >
                      <option value="">Kies de in gebreke gebleven partij...</option>
                      {duos.map((duo) => (
                        <option key={duo.id} value={duo.id}>
                          {duo.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === d.id || !atFaultChoice[d.id]}
                      onClick={() => resolveForfeit(d.id, "overturned")}
                      className="rounded-md border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/30"
                    >
                      Eenzijdig toewijzen
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
