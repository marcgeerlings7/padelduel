"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type NearbyEntry = { id: string; name: string; currentRating: number; position: number };
type DashboardDuoCard = {
  duo: {
    id: string;
    name: string;
    regionName: string;
    currentRating: number;
    position: number;
    ladderSize: number;
    tier: number;
    partnerEmail: string | null;
  };
  above: NearbyEntry[];
  below: NearbyEntry[];
};
type DashboardData = {
  duos: DashboardDuoCard[];
  activeDuoCount: number;
  maxActiveDuos: number;
  canFormMoreDuos: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon het dashboard niet laden.");
      });
  }, [router]);

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8" style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
        {error}
      </main>
    );
  }
  if (!data) {
    return <main className="px-4 py-8 sm:px-8 text-sm">Laden...</main>;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-4 py-8 sm:px-8" style={{ maxWidth: 1280 }}>
      <div className="flex flex-wrap items-end justify-between gap-3" style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: 0 }}>
          Mijn duo&apos;s
        </h1>
        {data.canFormMoreDuos && (
          <Link href="/duos/propose" className="btn btn-primary">
            + Nieuw duo ({data.activeDuoCount}/{data.maxActiveDuos})
          </Link>
        )}
      </div>
      <p style={{ color: "var(--color-neutral-700)", fontSize: 14, margin: "0 0 24px" }}>
        Je kunt lid zijn van meerdere actieve duo&apos;s tegelijk, tot het teammaximum van dit seizoen (
        {data.maxActiveDuos}).
      </p>
      <div className="hr" style={{ marginBottom: 24 }} />

      {data.duos.length === 0 && (
        <div className="card" style={{ marginBottom: 40 }}>
          <p style={{ margin: "0 0 12px" }}>Je bent nog geen lid van een actief duo.</p>
          <Link href="/duos/propose" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
            Vorm een duo
          </Link>
        </div>
      )}

      {data.duos.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 2,
            background: "var(--color-divider)",
            marginBottom: 40,
          }}
        >
          {data.duos.map((card) => (
            <section key={card.duo.id} className="card" style={{ borderRadius: 0 }}>
              <div className="card-kicker">
                Tier {card.duo.tier} · #{card.duo.position} · {card.duo.regionName}
              </div>
              <div className="card-title">{card.duo.name}</div>
              <div className="card-body">
                {card.duo.partnerEmail ? `Met ${card.duo.partnerEmail} · ` : ""}
                rating {card.duo.currentRating}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ marginTop: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-neutral-600)", marginBottom: 4 }}>
                    Boven jou
                  </p>
                  <ul style={{ fontSize: 13, margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    {card.above.length === 0 && <li style={{ color: "var(--color-neutral-500)" }}>—</li>}
                    {card.above.map((entry) => (
                      <li key={entry.id}>
                        #{entry.position} {entry.name} ({entry.currentRating})
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-neutral-600)", marginBottom: 4 }}>
                    Onder jou
                  </p>
                  <ul style={{ fontSize: 13, margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    {card.below.length === 0 && <li style={{ color: "var(--color-neutral-500)" }}>—</li>}
                    {card.below.map((entry) => (
                      <li key={entry.id}>
                        #{entry.position} {entry.name} ({entry.currentRating})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="card-meta flex flex-wrap gap-4" style={{ marginTop: 12 }}>
                <Link href={`/duos/${card.duo.id}/challenges`}>Challenges bekijken</Link>
                <Link href={`/duos/${card.duo.id}/rating-history`}>Ratinggeschiedenis</Link>
                <Link href={`/duos/${card.duo.id}/availability`}>Beschikbaarheid</Link>
              </div>
            </section>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, margin: "0 0 16px" }}>
        Openstaande uitnodigingen
      </h2>
      <div className="hr" style={{ marginBottom: 4 }} />
      <Link href="/duos/invitations" style={{ display: "inline-block", padding: "16px 0" }}>
        Mijn uitnodigingen bekijken
      </Link>
    </main>
  );
}
