"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Invitation = {
  id: string;
  duoName: string;
  proposedByUserId: string;
  invitedUserId: string;
  status: string;
  createdAt: string;
};
type InvitationsData = { received: Invitation[]; sent: Invitation[] };

export default function InvitationsPage() {
  const router = useRouter();
  const [data, setData] = useState<InvitationsData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    apiFetch<InvitationsData>("/api/duos/invitations").then(setData);
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
  }, [router]);

  async function respond(id: string, decision: "accept" | "decline") {
    setBusyId(id);
    try {
      await apiFetch(`/api/duos/invitations/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
          Mijn uitnodigingen
        </h1>
        <div className="hr" />
      </div>

      <section>
        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          Ontvangen (wacht op jouw reactie)
        </h2>
        {data.received.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Geen openstaande uitnodigingen.</p>}
        <ul style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--color-divider)" }}>
          {data.received.map((inv) => (
            <li
              key={inv.id}
              className="card"
              style={{ borderRadius: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <span style={{ fontWeight: 700 }}>{inv.duoName}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv.id, "accept")}
                  className="btn btn-primary"
                >
                  Accepteren
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv.id, "decline")}
                  className="btn btn-secondary"
                >
                  Weigeren
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          Verstuurd (wacht op de ander)
        </h2>
        {data.sent.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Geen openstaande voorstellen.</p>}
        <ul style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--color-divider)" }}>
          {data.sent.map((inv) => (
            <li key={inv.id} className="card" style={{ borderRadius: 0 }}>
              {inv.duoName}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
