"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { DuoChallengesView } from "@/components/duo/DuoChallengesView";
import { DuoSwitcher } from "@/components/matches/DuoSwitcher";
import { useMyDuos } from "@/lib/client/useMyDuos";
import { Button } from "@/components/ui/button";

export default function ChallengesPage() {
  const { duos, selectedId, setSelectedId, error } = useMyDuos();
  const selected = duos?.find((d) => d.id === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        title="Challenges"
        description={
          <>
            Uitdagen doe je vanaf de{" "}
            <Link href="/ladder" className="font-medium text-primary underline-offset-4 hover:underline">
              ladder
            </Link>
            , binnen je eigen rank-tier.
          </>
        }
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {error}
        </div>
      ) : null}

      {!duos && !error ? <ListSkeleton rows={4} label="Duo's laden…" /> : null}

      {duos && duos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Je hebt nog geen actief duo"
          description="Challenges speel je met een vaste partner. Vorm eerst een duo."
          action={
            <Button asChild>
              <Link href="/duos/propose">Vorm een duo</Link>
            </Button>
          }
        />
      ) : null}

      {duos && duos.length > 1 ? <DuoSwitcher duos={duos} value={selectedId} onChange={setSelectedId} /> : null}

      {selected ? (
        <DuoChallengesView key={selected.id} duoId={selected.id} duoName={selected.name} />
      ) : null}
    </Page>
  );
}
