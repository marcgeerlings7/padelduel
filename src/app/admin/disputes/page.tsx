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
    return (
      <main className="px-4 py-8 sm:px-8" style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
        {error}
      </main>
    );
  }
  if (!disputes) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="tag tag-accent" style={{ marginBottom: 10 }}>
        Beheerder
      </div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
        Openstaande disputes
      </h1>
      <div className="hr" style={{ margin: 0 }} />

      {disputes.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Geen openstaande disputes.</p>}

      <ul className="flex flex-col gap-3">
        {disputes.map((d) => {
          const duos = d.match?.challenge.challengerDuo
            ? [d.match.challenge.challengerDuo, d.match.challenge.challengedDuo]
            : d.challenge
              ? [d.challenge.challengerDuo, d.challenge.challengedDuo]
              : [];

          return (
            <li key={d.id} className="card">
              <div className="card-kicker">{d.subject === "MATCH_SCORE" ? "Score-dispute" : "Forfeit-dispute"}</div>
              <p style={{ fontWeight: 700, margin: 0 }}>
                {duos[0]?.name} vs. {duos[1]?.name}
              </p>
              {d.match && (
                <p style={{ color: "var(--color-neutral-700)", fontSize: 13, margin: 0 }}>
                  Ingediende score: {d.match.scoreRaw}
                </p>
              )}
              <p style={{ color: "var(--color-neutral-700)", fontSize: 13, margin: 0 }}>
                Reden ({d.raisedByUser.email}): {d.reason}
              </p>

              {d.subject === "MATCH_SCORE" && (
                <div className="flex gap-2" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveMatchScore(d.id, "upheld")}
                    className="btn btn-primary"
                  >
                    Score handhaven
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveMatchScore(d.id, "overturned")}
                    className="btn btn-secondary"
                  >
                    Match ongeldig verklaren
                  </button>
                </div>
              )}

              {d.subject === "FORFEIT" && (
                <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resolveForfeit(d.id, "upheld")}
                    className="btn btn-primary"
                    style={{ alignSelf: "flex-start" }}
                  >
                    Penalty bij beide handhaven
                  </button>
                  <div className="flex items-center gap-2">
                    <select
                      value={atFaultChoice[d.id] ?? ""}
                      onChange={(e) => setAtFaultChoice((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      className="input"
                      style={{ width: "auto" }}
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
                      className="btn btn-secondary"
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
