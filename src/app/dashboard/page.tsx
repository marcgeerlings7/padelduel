"use client";

import { Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DuoCard, type HistoryState } from "@/components/dashboard/DuoCard";
import { InvitationsPanel } from "@/components/dashboard/InvitationsPanel";
import { DisplayNameBanner } from "@/components/profile/DisplayNameBanner";
import type { DashboardData, InvitationsData, RatingHistoryRow } from "@/components/dashboard/types";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryState>>({});
  const [invitations, setInvitations] = useState<InvitationsData | null | "error">(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;

    apiFetch<DashboardData>("/api/dashboard")
      .then((dashboard) => {
        if (cancelled) return;
        setData(dashboard);
        // Sparkline-data per duo (parallel, faalt stil: de kaart werkt ook zonder).
        for (const { duo } of dashboard.duos) {
          apiFetch<RatingHistoryRow[]>(`/api/duos/${duo.id}/rating-history`)
            .then((rows) => !cancelled && setHistories((prev) => ({ ...prev, [duo.id]: rows })))
            .catch(() => !cancelled && setHistories((prev) => ({ ...prev, [duo.id]: "error" })));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon je duo's niet laden. Ververs de pagina om het opnieuw te proberen.");
      });

    apiFetch<InvitationsData>("/api/duos/invitations")
      .then((inv) => !cancelled && setInvitations(inv))
      .catch(() => !cancelled && setInvitations("error"));


    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasDuos = Boolean(data && data.duos.length > 0);
  const description = data
    ? hasDuos
      ? `Je speelt in ${data.activeDuoCount} van maximaal ${data.maxActiveDuos} ${
          data.maxActiveDuos === 1 ? "duo" : "duo's"
        } tegelijk.`
      : `Je kunt in maximaal ${data.maxActiveDuos} ${data.maxActiveDuos === 1 ? "duo" : "duo's"} tegelijk spelen.`
    : "Je duo's, hun plek op de ladder en openstaande uitnodigingen.";

  return (
    <Page width="wide">
      <PageHeader
        title="Mijn duo's"
        description={description}
        actions={
          data && hasDuos && data.canFormMoreDuos ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/duos/propose">
                <Plus aria-hidden />
                Nieuw duo ({data.activeDuoCount}/{data.maxActiveDuos})
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DisplayNameBanner />

      {error ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {error}
        </div>
      ) : null}

      {!data && !error ? <DashboardSkeleton /> : null}

      {data && !hasDuos ? (
        <EmptyState
          icon={UsersRound}
          title="Je zit nog niet in een duo"
          description="Kies een partner en een regio. Zodra je partner het voorstel accepteert, staan jullie samen op de ladder."
          action={
            <Button asChild size="lg">
              <Link href="/duos/propose">Vorm een duo</Link>
            </Button>
          }
          className="bg-card"
        />
      ) : null}

      {data && hasDuos ? (
        <div className="flex flex-col gap-4">
          {data.duos.map((card) => (
            <DuoCard key={card.duo.id} card={card} history={histories[card.duo.id] ?? null} />
          ))}
        </div>
      ) : null}

      {data || error ? <InvitationsPanel data={invitations} /> : null}
    </Page>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Je duo&apos;s laden…</span>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-5 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-14 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
            <Skeleton className="size-14 rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, j) => (
              <Skeleton key={j} className="h-10" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-11" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
