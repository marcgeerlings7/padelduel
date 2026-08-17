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
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
        Duo voorstellen
      </h1>
      <div className="hr" style={{ margin: 0 }} />
      <form onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Regio</label>
          <select className="input" value={regionSlug} onChange={(e) => setRegionSlug(e.target.value)}>
            {regions.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>E-mailadres van je partner</label>
          <input
            className="input"
            type="email"
            required
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 24 }}>
          <label>Duo-naam (optioneel)</label>
          <div className="flex gap-2">
            <input
              className="input"
              type="text"
              value={duoName}
              onChange={(e) => setDuoName(e.target.value)}
              placeholder="Laat leeg om er één te laten verzinnen"
            />
            <button type="button" onClick={handleSuggestName} className="btn btn-secondary" style={{ flexShrink: 0 }}>
              🎲 Verzin
            </button>
          </div>
        </div>
        {message && (
          <p style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 700, marginBottom: 16 }}>
            {message}
          </p>
        )}
        {error && <p style={{ fontSize: 13, color: "var(--color-accent-700)", marginBottom: 16 }}>{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary btn-block">
          {submitting ? "Bezig..." : "Voorstel versturen"}
        </button>
      </form>
    </main>
  );
}
