"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  opponentName: string | null;
};

function RatingChart({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 640;
  const h = 200;
  const pad = 20;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-divider)" strokeWidth={2} />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={3} />
      {coords.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r={3} fill="var(--color-text)" />
      ))}
    </svg>
  );
}

export function DuoRatingHistoryView({ duoId }: { duoId: string }) {
  const router = useRouter();
  const [history, setHistory] = useState<RatingHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    setHistory(null);
    apiFetch<RatingHistoryEntry[]>(`/api/duos/${duoId}/rating-history`)
      .then(setHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon de ratinggeschiedenis niet laden.");
      });
  }, [duoId, router]);

  if (error) {
    return <p style={{ fontSize: 14, color: "var(--color-accent-700)" }}>{error}</p>;
  }
  if (!history) {
    return <p className="text-sm">Laden...</p>;
  }

  const currentRating = history[0]?.ratingAfter;
  // chronologisch (oud → nieuw) voor de grafiek, terwijl de tabel nieuw → oud toont
  const points = [...history].reverse().map((entry) => entry.ratingAfter);

  return (
    <>
      {currentRating !== undefined && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32 }}>{currentRating}</div>
        </div>
      )}

      {history.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Nog geen ratingwijzigingen.</p>}

      {points.length >= 2 && (
        <div className="card" style={{ borderRadius: 0, padding: 24, marginTop: 12 }}>
          <RatingChart points={points} />
        </div>
      )}

      {history.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className="table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Tegen</th>
                <th>Resultaat</th>
                <th>Δ Rating</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const delta = entry.ratingAfter - entry.ratingBefore;
                const sign = delta >= 0 ? "+" : "";
                return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleDateString("nl-NL")}</td>
                    <td>{entry.opponentName ?? "—"}</td>
                    <td>{delta >= 0 ? "Winst" : "Verlies"}</td>
                    <td style={{ color: delta >= 0 ? "var(--color-accent-700)" : "var(--color-text)", fontWeight: 700 }}>
                      {sign}
                      {delta}{" "}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-neutral-600)" }}>
                        ({entry.ratingBefore} → {entry.ratingAfter})
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${entry.isForfeit ? "tag-accent" : "tag-neutral"}`}>
                        {entry.isForfeit ? "Forfeit-penalty" : "Wedstrijdresultaat"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
