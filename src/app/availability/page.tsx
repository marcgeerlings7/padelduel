"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/EmptyState";
import { CardSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { DuoPicker } from "@/components/availability/DuoPicker";
import { AVAILABILITY_DESCRIPTION } from "@/components/availability/copy";
import { DuoAvailabilityView } from "@/components/duo/DuoAvailabilityView";
import { Button } from "@/components/ui/button";
import { useMyDuos } from "@/lib/client/useMyDuos";

export default function AvailabilityPage() {
  const { duos, selectedId, setSelectedId, error } = useMyDuos();

  return (
    <Page>
      <PageHeader title="Beschikbaarheid" description={AVAILABILITY_DESCRIPTION} />

      {error ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {error} Vernieuw de pagina om het opnieuw te proberen.
        </div>
      ) : null}

      {!duos && !error ? <CardSkeleton lines={6} label="Duo's laden" /> : null}

      {duos && duos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Je bent nog geen lid van een actief duo"
          description="Beschikbaarheid hoort bij een duo. Vorm eerst een duo met je padelpartner."
          action={
            <Button asChild>
              <Link href="/duos/propose">Vorm een duo</Link>
            </Button>
          }
        />
      ) : null}

      {duos && duos.length > 1 ? (
        <DuoPicker duos={duos} selectedId={selectedId} onSelect={setSelectedId} />
      ) : null}

      {selectedId ? <DuoAvailabilityView key={selectedId} duoId={selectedId} /> : null}
    </Page>
  );
}
