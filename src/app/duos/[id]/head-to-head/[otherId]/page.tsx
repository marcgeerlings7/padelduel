"use client";

import { useParams } from "next/navigation";
import { HeadToHeadView } from "@/components/matches/HeadToHeadView";

export default function HeadToHeadPage() {
  const params = useParams<{ id: string; otherId: string }>();
  return <HeadToHeadView duoId={params.id} otherId={params.otherId} />;
}
