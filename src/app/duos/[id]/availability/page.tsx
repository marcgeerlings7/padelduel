"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { AVAILABILITY_DESCRIPTION } from "@/components/availability/copy";
import { DuoAvailabilityView } from "@/components/duo/DuoAvailabilityView";
import { useMyDuos } from "@/lib/client/useMyDuos";

export default function DuoAvailabilityPage() {
  const params = useParams<{ id: string }>();
  // Alleen voor de duo-naam in de kop; lidmaatschap controleert de API.
  const { duos } = useMyDuos();
  const duoName = duos?.find((d) => d.id === params.id)?.name;

  return (
    <Page>
      <PageHeader
        title="Beschikbaarheid"
        description={AVAILABILITY_DESCRIPTION}
        back={{ href: "/dashboard", label: "Mijn duo's" }}
        meta={duoName ? <Badge variant="soft">{duoName}</Badge> : null}
      />
      <DuoAvailabilityView duoId={params.id} />
    </Page>
  );
}
