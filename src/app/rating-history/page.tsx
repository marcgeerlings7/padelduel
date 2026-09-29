"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/EmptyState";
import { StatGridSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { DuoRatingHistoryView } from "@/components/duo/DuoRatingHistoryView";
import { DuoSwitcher } from "@/components/matches/DuoSwitcher";
import { useOwnDuos } from "@/components/matches/useOwnDuos";
import { Button } from "@/components/ui/button";

export default function RatingHistoryPage() {
  const { duos, selectedId, setSelectedId, error } = useOwnDuos();
  const selected = duos?.find((d) => d.id === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        title="Ratinggeschiedenis"
        description="Hoe de rating van jullie duo zich ontwikkelt, wedstrijd na wedstrijd."
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {error}
        </div>
      ) : null}

      {!duos && !error ? <StatGridSkeleton count={4} className="grid grid-cols-2 gap-3 lg:grid-cols-4" /> : null}

      {duos && duos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Je hebt nog geen actief duo"
          description="Een rating hoort bij een duo. Vorm eerst een duo met je padelpartner."
          action={
            <Button asChild>
              <Link href="/duos/propose">Vorm een duo</Link>
            </Button>
          }
        />
      ) : null}

      {duos && duos.length > 1 ? <DuoSwitcher duos={duos} value={selectedId} onChange={setSelectedId} /> : null}

      {selected ? (
        <DuoRatingHistoryView key={selected.id} duoId={selected.id} regionSlug={selected.region.slug} />
      ) : null}
    </Page>
  );
}
