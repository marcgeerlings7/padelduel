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
};
type MyDuo = { id: string; name: string; regionId: string; tier: number };
type ChallengeSummary = { status: string };

export default function LadderPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [ladder, setLadder] = useState<LadderEntry[] | null>(null);
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
    apiFetch<{ ladder: LadderEntry[] }>(`/api/ladder?regionSlug=${selectedSlug}`)
      .then((data) => setLadder(data.ladder))
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Ladder</h1>

      {regions.length > 0 && (
        <label className="flex flex-col gap-1 text-sm sm:w-64">
          Regio
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="rounded-md border border-black/20 px-3 py-2 dark:border-white/30 dark:bg-transparent"
          >
            {regions.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {myDuosInRegion.length > 1 && (
        <label className="flex flex-col gap-1 text-sm sm:w-64">
          Uitdagen namens
          <select
            value={actingDuoId}
            onChange={(e) => setActingDuoId(e.target.value)}
            className="rounded-md border border-black/20 px-3 py-2 dark:border-white/30 dark:bg-transparent"
          >
            {myDuosInRegion.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {actingDuo && actingDuoBusy && (
        <p className="text-sm text-black/60 dark:text-white/60">
          {actingDuo.name} heeft al een actieve challenge — uitdagen is pas weer mogelijk als die is
          afgerond.
        </p>
      )}

      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {ladder && (
        <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/20">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/20">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Duo</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2 text-right">Rating</th>
                {actingDuo && <th className="px-3 py-2" />}
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
                    className={
                      "border-b border-black/5 last:border-0 dark:border-white/10" +
                      (isMine ? " bg-yellow-100 font-semibold dark:bg-yellow-900/40" : "") +
                      (isChallengeable ? " bg-green-50 dark:bg-green-900/20" : "")
                    }
                  >
                    <td className="px-3 py-2">{entry.position}</td>
                    <td className="px-3 py-2">
                      {entry.name}
                      {isMine && " (jouw duo)"}
                    </td>
                    <td className="px-3 py-2">{entry.tier}</td>
                    <td className="px-3 py-2 text-right">{entry.currentRating}</td>
                    {actingDuo && (
                      <td className="px-3 py-2 text-right">
                        {isChallengeable && (
                          <button
                            type="button"
                            disabled={actingDuoBusy || challengingId === entry.id}
                            onClick={() => handleChallenge(entry.id)}
                            title={actingDuoBusy ? "Je hebt al een actieve challenge" : undefined}
                            className="rounded-md border border-black/20 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/30"
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
