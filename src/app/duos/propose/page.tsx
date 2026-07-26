"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };

export default function ProposeDuoPage() {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionSlug, setRegionSlug] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [duoName, setDuoName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<Region[]>("/api/regions").then((data) => {
      setRegions(data);
      if (data.length > 0) setRegionSlug(data[0].slug);
    });
  }, [router]);

  async function handleSuggestName() {
    try {
      const result = await apiFetch<{ name: string }>("/api/duos/name-suggestion");
      setDuoName(result.name);
    } catch {
      // gimmick, geen harde fout nodig als dit een keer mislukt
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/duos/propose", {
        method: "POST",
        body: JSON.stringify({
          regionSlug,
          invitedEmail,
          duoName: duoName.trim() || undefined,
        }),
      });
      setMessage("Voorstel verstuurd! Zodra de andere speler bevestigt, zien jullie het duo terug.");
      setInvitedEmail("");
      setDuoName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-xl font-bold">Duo voorstellen</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Regio
          <select
            value={regionSlug}
            onChange={(e) => setRegionSlug(e.target.value)}
            className="rounded-md border border-black/20 px-3 py-2 dark:border-white/30 dark:bg-transparent"
          >
            {regions.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          E-mailadres van je partner
          <input
            type="email"
            required
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
            className="rounded-md border border-black/20 px-3 py-2 dark:border-white/30 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duo-naam (optioneel)
          <div className="flex gap-2">
            <input
              type="text"
              value={duoName}
              onChange={(e) => setDuoName(e.target.value)}
              placeholder="Laat leeg om er één te laten verzinnen"
              className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/30 dark:bg-transparent"
            />
            <button
              type="button"
              onClick={handleSuggestName}
              className="shrink-0 rounded-md border border-black/20 px-3 py-2 text-sm dark:border-white/30"
            >
              🎲 Verzin
            </button>
          </div>
        </label>
        {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Bezig..." : "Voorstel versturen"}
        </button>
      </form>
    </main>
  );
}
