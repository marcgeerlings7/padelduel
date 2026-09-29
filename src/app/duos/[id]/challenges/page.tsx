"use client";

import { useParams } from "next/navigation";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { DuoChallengesView } from "@/components/duo/DuoChallengesView";
import { DuoMeta } from "@/components/matches/DuoMeta";
import { DuoSectionNav } from "@/components/matches/DuoSectionNav";
import { useOwnDuos } from "@/components/matches/useOwnDuos";

export default function DuoChallengesPage() {
  const params = useParams<{ id: string }>();
  const { duos } = useOwnDuos();
  const duo = duos?.find((d) => d.id === params.id) ?? null;

  return (
    <Page>
      <PageHeader
        title="Challenges"
        back={{ href: "/dashboard", label: "Mijn duo's" }}
        meta={
          duos && !duo ? null : (
            <DuoMeta name={duo?.name ?? null} regionName={duo?.region.name} tier={duo?.tier} own />
          )
        }
      />
      <div className="flex flex-col gap-5">
        <DuoSectionNav duoId={params.id} current="challenges" />
        <DuoChallengesView duoId={params.id} duoName={duo?.name} />
      </div>
    </Page>
  );
}
