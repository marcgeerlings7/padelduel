"use client";

import { useParams } from "next/navigation";
import { DuoChallengesView } from "@/components/duo/DuoChallengesView";

export default function DuoChallengesPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
        Challenges
      </h1>
      <div className="hr" style={{ margin: 0 }} />
      <DuoChallengesView duoId={params.id} />
    </main>
  );
}
