"use client";

import Link from "next/link";
import { useMyDuos } from "@/lib/client/useMyDuos";
import { DuoAvailabilityView } from "@/components/duo/DuoAvailabilityView";

export default function AvailabilityPage() {
  const { duos, selectedId, setSelectedId, error } = useMyDuos();

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

      {error && <p style={{ fontSize: 14, color: "var(--color-accent-700)" }}>{error}</p>}

      {duos && duos.length === 0 && (
        <div className="card">
          <p style={{ margin: "0 0 12px" }}>Je bent nog geen lid van een actief duo.</p>
          <Link href="/duos/propose" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
            Vorm een duo
          </Link>
        </div>
      )}

      {duos && duos.length > 1 && (
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Duo</label>
          <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {duos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedId && <DuoAvailabilityView duoId={selectedId} />}
    </main>
  );
}
