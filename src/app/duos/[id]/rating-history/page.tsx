"use client";

import { useParams } from "next/navigation";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { DuoRatingHistoryView } from "@/components/duo/DuoRatingHistoryView";
import { DuoMeta } from "@/components/matches/DuoMeta";
import { DuoSectionNav } from "@/components/matches/DuoSectionNav";
import { useOwnDuos } from "@/components/matches/useOwnDuos";

export default function DuoRatingHistoryPage() {
  const params = useParams<{ id: string }>();
  const { duos } = useOwnDuos();
  const duo = duos?.find((d) => d.id === params.id) ?? null;
  const own = duos === null || duo !== null;

  return (
    <Page>
      <PageHeader
        title="Ratinggeschiedenis"
        back={{ href: "/dashboard", label: "Mijn duo's" }}
        meta={duos && !duo ? null : <DuoMeta name={duo?.name ?? null} regionName={duo?.region.name} tier={duo?.tier} own />}
      />
      <div className="flex flex-col gap-5">
        <DuoSectionNav duoId={params.id} current="rating-history" own={own} />
        <DuoRatingHistoryView duoId={params.id} regionSlug={duo?.region.slug} />
      </div>
    </Page>
  );
}
