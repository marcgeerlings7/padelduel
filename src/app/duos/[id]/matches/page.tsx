"use client";

import { useParams } from "next/navigation";
import { MatchHistoryView } from "@/components/matches/MatchHistoryView";

export default function DuoMatchesPage() {
  const params = useParams<{ id: string }>();
  return <MatchHistoryView duoId={params.id} />;
}
