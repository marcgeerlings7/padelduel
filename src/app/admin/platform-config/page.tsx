"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type ConfigEntry = { key: string; value: string; description: string | null };

export default function AdminPlatformConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<ConfigEntry[]>("/api/admin/platform-config")
      .then(setConfig)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de platform config niet laden.");
      });
  }, [router]);

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8" style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
        {error}
      </main>
    );
  }
  if (!config) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-4 py-8 sm:px-8" style={{ maxWidth: 1280 }}>
      <div className="tag tag-accent" style={{ marginBottom: 10 }}>
        Beheerder
      </div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: "0 0 8px" }}>
        Platform config
      </h1>
      <p style={{ color: "var(--color-neutral-700)", fontSize: 14, margin: "0 0 24px" }}>
        Alle tunable parameters op één plek — nooit hardcoded.
      </p>
      <div className="hr" style={{ marginBottom: 24 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 2,
          background: "var(--color-divider)",
        }}
      >
        {config.map((p) => (
          <div key={p.key} className="card" style={{ borderRadius: 0 }} title={p.description ?? undefined}>
            <div className="card-kicker">{p.key}</div>
            <div className="card-title" style={{ fontSize: 22 }}>
              {p.value}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
