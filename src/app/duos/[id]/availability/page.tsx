"use client";

import { useParams } from "next/navigation";
import { DuoAvailabilityView } from "@/components/duo/DuoAvailabilityView";

export default function DuoAvailabilityPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:px-8">
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: 0 }}>
        Beschikbaarheid
      </h1>
      <p style={{ color: "var(--color-neutral-700)", fontSize: 14, margin: 0, maxWidth: "60ch" }}>
        Zichtbaar voor tegenstanders om een wedstrijd in te plannen. Alleen duo-naam, regio en tijdsblok
        worden gedeeld — nooit je e-mailadres of gebruikers-id.
      </p>
      <div className="hr" style={{ margin: 0 }} />
      <DuoAvailabilityView duoId={params.id} />
    </main>
  );
}
