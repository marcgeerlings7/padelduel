"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };
type LadderEntry = {
  id: string;
  name: string;
  currentRating: number;
  position: number;
  tier: number;
  wins: number;
  losses: number;
  streak: string;
};
type LadderResponse = { region: Region; ladder: LadderEntry[]; tierSize: number };
type MyDuo = { id: string; name: string; regionId: string; tier: number };
type ChallengeSummary = { status: string };

export default function LadderPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [ladder, setLadder] = useState<LadderEntry[] | null>(null);
  const [tierSize, setTierSize] = useState<number | null>(null);
  const [myDuos, setMyDuos] = useState<MyDuo[]>([]);
  const [actingDuoId, setActingDuoId] = useState<string>("");
  const [actingDuoBusy, setActingDuoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [challengingId, setChallengingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Region[]>("/api/regions")
      .then((data) => {
        setRegions(data);
        if (data.length > 0) setSelectedSlug(data[0].slug);
      })
      .catch(() => setError("Kon regio's niet laden."));
  }, []);

  useEffect(() => {
    if (getStoredToken()) {
      apiFetch<MyDuo[]>("/api/duos/mine")
        .then(setMyDuos)
        .catch(() => {
          /* niet ingelogd of geen duo's: geen markering, geen harde fout */
        });
    }
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    setLadder(null);
    apiFetch<LadderResponse>(`/api/ladder?regionSlug=${selectedSlug}`)
      .then((data) => {
        setLadder(data.ladder);
        setTierSize(data.tierSize);
      })
      .catch(() => setError("Kon de ladder niet laden."));
  }, [selectedSlug]);

  // useMemo (i.p.v. inline berekenen) zodat de effect hieronder correct
  // opnieuw draait zodra ladder/regions/myDuos alsnog binnenkomen — met een
  // plain const + deps [selectedSlug, myDuos.length] miste de effect een
  // update wanneer myDuos vóór de ladder-data geladen werd (race condition).
  const myDuosInRegion = useMemo(
    () =>
      myDuos.filter(
        (d) => ladder && ladder.length > 0 && regions.find((r) => r.slug === selectedSlug)?.id === d.regionId,
      ),
    [myDuos, ladder, regions, selectedSlug],
  );

  useEffect(() => {
    setActingDuoId(myDuosInRegion[0]?.id ?? "");
  }, [myDuosInRegion]);

  useEffect(() => {
    if (!actingDuoId) {
      setActingDuoBusy(false);
      return;
    }
    apiFetch<ChallengeSummary[]>(`/api/duos/${actingDuoId}/challenges`)
      .then((challenges) =>
        setActingDuoBusy(challenges.some((c) => c.status === "PENDING" || c.status === "ACCEPTED")),
      )
      .catch(() => setActingDuoBusy(false));
  }, [actingDuoId]);

  const actingDuo = myDuosInRegion.find((d) => d.id === actingDuoId);

  async function handleChallenge(challengedDuoId: string) {
    if (!actingDuoId) return;
    setChallengingId(challengedDuoId);
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/api/challenges", {
        method: "POST",
        body: JSON.stringify({ challengerDuoId: actingDuoId, challengedDuoId }),
      });
      setMessage("Uitdaging verstuurd!");
      setActingDuoBusy(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setChallengingId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="tag tag-accent" style={{ marginBottom: 10 }}>
            Regionale ladder
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: 0 }}>
            Ladder
          </h1>
        </div>
        {ladder && ladder.length > 0 && tierSize && (
          <div className="flex flex-wrap gap-2">
            <span className="tag tag-outline">
              {Math.max(...ladder.map((e) => e.tier)) + 1} tiers · {tierSize} pt/tier
            </span>
          </div>
        )}
      </div>
      <div className="hr" style={{ margin: 0 }} />

      <div className="flex flex-wrap gap-4">
        {regions.length > 0 && (
          <div className="field" style={{ minWidth: 220 }}>
            <label>Regio</label>
            <select className="input" value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
              {regions.map((region) => (
                <option key={region.id} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {myDuosInRegion.length > 1 && (
          <div className="field" style={{ minWidth: 220 }}>
            <label>Uitdagen namens</label>
            <select className="input" value={actingDuoId} onChange={(e) => setActingDuoId(e.target.value)}>
              {myDuosInRegion.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actingDuo && actingDuoBusy && (
        <p className="text-muted" style={{ fontSize: 13 }}>
          {actingDuo.name} heeft al een actieve challenge — uitdagen is pas weer mogelijk als die is
          afgerond.
        </p>
      )}

      {actingDuo &&
        !actingDuoBusy &&
        ladder &&
        !ladder.some((e) => e.tier === actingDuo.tier && e.id !== actingDuo.id) && (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Er staat momenteel geen ander duo in Tier {actingDuo.tier} — {actingDuo.name} kan nu niemand
            uitdagen. Zodra een duo in dezelfde tier komt te staan, verschijnt hier een uitdaagknop.
          </p>
        )}

      {message && (
        <p style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 700 }}>{message}</p>
      )}
      {error && <p style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p>}

      {ladder && (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Duo</th>
                <th>Tier</th>
                <th style={{ textAlign: "right" }}>Rating</th>
                <th style={{ textAlign: "right" }}>W-L</th>
                <th style={{ textAlign: "right" }}>Streak</th>
                {actingDuo && <th />}
              </tr>
            </thead>
            <tbody>
              {ladder.map((entry) => {
                const isMine = myDuos.some((d) => d.id === entry.id);
                const isChallengeable =
                  Boolean(actingDuo) && !isMine && entry.tier === actingDuo!.tier;
                return (
                  <tr
                    key={entry.id}
                    data-own={isMine || undefined}
                    style={{
                      fontWeight: isMine ? 700 : undefined,
                      background: isMine
                        ? "var(--color-accent-100)"
                        : isChallengeable
                          ? "var(--color-neutral-100)"
                          : undefined,
                    }}
                  >
                    <td style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{entry.position}</td>
                    <td>
                      {entry.name}
                      {isMine && " (jouw duo)"}
                    </td>
                    <td>
                      <span className="tag tag-outline">Tier {entry.tier}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>{entry.currentRating}</td>
                    <td style={{ textAlign: "right" }}>
                      {entry.wins}-{entry.losses}
                    </td>
                    <td style={{ textAlign: "right" }}>{entry.streak}</td>
                    {actingDuo && (
                      <td style={{ textAlign: "right" }}>
                        {isChallengeable && (
                          <button
                            type="button"
                            disabled={actingDuoBusy || challengingId === entry.id}
                            onClick={() => handleChallenge(entry.id)}
                            title={actingDuoBusy ? "Je hebt al een actieve challenge" : undefined}
                            className="btn btn-ghost"
                          >
                            Uitdagen
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
