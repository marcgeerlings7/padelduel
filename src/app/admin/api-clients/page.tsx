"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };
type ApiClientSummary = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  region: Region | null;
};

export default function AdminApiClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ApiClientSummary[] | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    apiFetch<ApiClientSummary[]>("/api/admin/api-clients")
      .then(setClients)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de API-clients niet laden.");
      });
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
    apiFetch<Region[]>("/api/regions").then(setRegions);
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNewKey(null);
    try {
      const result = await apiFetch<{ plaintextKey: string }>("/api/admin/api-clients", {
        method: "POST",
        body: JSON.stringify({ name, regionId: regionId || undefined }),
      });
      setNewKey(result.plaintextKey);
      setName("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/api-clients/${id}/revoke`, { method: "POST" });
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
  if (!clients) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="tag tag-accent" style={{ marginBottom: 10 }}>
        Beheerder
      </div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
        API-clients
      </h1>
      <div className="hr" style={{ margin: 0 }} />

      {newKey && (
        <div className="card" style={{ borderLeft: "4px solid var(--color-accent)" }}>
          <p style={{ fontWeight: 700, margin: 0 }}>Nieuwe API-key (wordt maar één keer getoond!):</p>
          <code style={{ wordBreak: "break-all" }}>{newKey}</code>
        </div>
      )}

      <ul style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--color-divider)" }}>
        {clients.map((c) => (
          <li
            key={c.id}
            className="card"
            style={{ borderRadius: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>
              {c.name} — {c.region?.name ?? "alle regio's"} —{" "}
              {c.isActive ? "actief" : "ingetrokken"}
            </span>
            {c.isActive && (
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => handleRevoke(c.id)}
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
              >
                Intrekken
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="card">
        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, margin: 0 }}>
          Nieuwe API-client
        </h2>
        <div className="field">
          <label>Naam</label>
          <input className="input" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Regio (optioneel, leeg = alle regio&apos;s)</label>
          <select className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">Alle regio&apos;s</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {formError && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{formError}</p>}
        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Aanmaken
        </button>
      </form>
    </main>
  );
}
