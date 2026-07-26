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
        <h1 className="text-xl font-bold">Mijn uitnodigingen</h1>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Ontvangen (wacht op jouw reactie)</h2>
        {data.received.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">Geen openstaande uitnodigingen.</p>
        )}
        <ul className="flex flex-col gap-2">
          {data.received.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
            >
              <span>{inv.duoName}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv.id, "accept")}
                  className="rounded-md bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  Accepteren
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv.id, "decline")}
                  className="rounded-md border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/30"
                >
                  Weigeren
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Verstuurd (wacht op de ander)</h2>
        {data.sent.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">Geen openstaande voorstellen.</p>
        )}
        <ul className="flex flex-col gap-2">
          {data.sent.map((inv) => (
            <li
              key={inv.id}
              className="rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
            >
              {inv.duoName}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
