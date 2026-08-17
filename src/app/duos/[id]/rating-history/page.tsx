"use client";

import { useParams } from "next/navigation";
import { DuoRatingHistoryView } from "@/components/duo/DuoRatingHistoryView";

export default function RatingHistoryPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: 0 }}>
        Ratinggeschiedenis
      </h1>
      <div className="hr" style={{ margin: 0 }} />
      <DuoRatingHistoryView duoId={params.id} />
    </main>
  );
}
