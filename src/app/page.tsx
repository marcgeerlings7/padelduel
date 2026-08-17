"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredToken } from "@/lib/client/session";

export default function Home() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // Voorkomt een flits van de marketingpagina vlak voordat de redirect
  // naar /dashboard plaatsvindt voor een reeds ingelogde gebruiker.
  if (!checkedAuth) return null;

  return (
    <main>
      {/* ---------------------------------------------------------- Hero */}
      <section
        style={{
          position: "relative",
          minHeight: "clamp(480px,80vh,760px)",
          display: "flex",
          alignItems: "flex-end",
          backgroundImage:
            "linear-gradient(180deg, rgba(20,20,20,0.35) 0%, rgba(20,20,20,0.55) 55%, rgba(20,20,20,0.92) 100%), url(/images/net-closeup.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(32px,6vw,80px) clamp(20px,4vw,48px) clamp(48px,7vw,88px)",
            color: "var(--color-bg)",
          }}
        >
          <div className="tag tag-accent" style={{ marginBottom: 16 }}>
            Seizoen 2026
          </div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "clamp(40px,7vw,84px)",
              lineHeight: 0.95,
              textTransform: "uppercase",
              margin: "0 0 20px",
              maxWidth: "16ch",
            }}
          >
            Klim de ladder.
          </h1>
          <p style={{ fontSize: "clamp(16px,2vw,20px)", maxWidth: "44ch", margin: "0 0 32px", opacity: 0.92 }}>
            Vereniging-onafhankelijke ranked ladder voor padel-duo&apos;s. Daag duo&apos;s uit binnen
            jouw tier, speel de wedstrijd, en zie je ELO-rating stijgen — met meerdere vaste partners
            tegelijk als je wilt.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary">
              Account aanmaken
            </Link>
            <Link
              href="/ladder"
              className="btn btn-secondary"
              style={{ background: "transparent", color: "var(--color-bg)", borderColor: "var(--color-bg)" }}
            >
              Bekijk de ladder
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Hoe het werkt */}
      <section className="mx-auto" style={{ maxWidth: 1280, padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)" }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: "clamp(26px,3.5vw,36px)",
            margin: "0 0 8px",
          }}
        >
          Zo werkt het
        </h2>
        <p style={{ color: "var(--color-neutral-700)", fontSize: 15, margin: "0 0 32px", maxWidth: "60ch" }}>
          Drie stappen tussen &ldquo;ingelogd&rdquo; en &ldquo;hoger op de ladder&rdquo;.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 2,
            background: "var(--color-divider)",
          }}
        >
          <div className="card" style={{ borderRadius: 0 }}>
            <div className="card-kicker">Stap 1</div>
            <div className="card-title">Vorm een duo, daag uit</div>
            <div className="card-body">
              Vind een vaste partner en kies een duo-naam. Vanaf de ladder daag je duo&apos;s in jouw
              eigen tier uit.
            </div>
          </div>
          <div className="card" style={{ borderRadius: 0 }}>
            <div className="card-kicker">Stap 2</div>
            <div className="card-title">Speel de wedstrijd</div>
            <div className="card-body">
              Wordt de uitdaging geaccepteerd? Speel binnen de termijn, voer de score in en laat het
              andere duo bevestigen.
            </div>
          </div>
          <div className="card" style={{ borderRadius: 0 }}>
            <div className="card-kicker">Stap 3</div>
            <div className="card-title">Klim de ladder</div>
            <div className="card-body">
              Je ELO-rating past zich automatisch aan. Win je vaker dan verwacht, dan stijg je
              gestaag — en verschuift je tier mee.
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Quote band */}
      <section
        style={{
          position: "relative",
          padding: "clamp(64px,10vw,120px) clamp(20px,4vw,48px)",
          backgroundImage:
            "linear-gradient(180deg, rgba(10,20,15,0.75), rgba(10,20,15,0.75)), url(/images/ball-shadow.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", color: "var(--color-bg)" }}>
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "clamp(22px,3.2vw,34px)",
              lineHeight: 1.3,
              margin: "0 0 24px",
            }}
          >
            Van beginnersniveau tot regiokampioen — de ELO-rating zorgt dat je altijd tegen duo&apos;s
            van jouw eigen niveau speelt.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="tag tag-neutral">Multi-duo ondersteund</span>
            <span className="tag tag-outline" style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}>
              ELO-rating
            </span>
            <span className="tag tag-outline" style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}>
              Nooit hardcoded regels
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Split content */}
      <section
        className="mx-auto grid gap-8 sm:grid-cols-2"
        style={{ maxWidth: 1280, padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)", alignItems: "center" }}
      >
        <div
          style={{
            aspectRatio: "4 / 5",
            backgroundImage: "url(/images/warminup-closeup.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div>
          <div className="tag tag-accent" style={{ marginBottom: 10 }}>
            Eerlijk & transparant
          </div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "clamp(24px,3.2vw,32px)",
              margin: "0 0 16px",
            }}
          >
            Elke regel is zichtbaar
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
            Geen verborgen ranking-logica. De tier-breedte, deadlines, forfeit-penalty&apos;s en de
            precieze ELO-berekening staan allemaal uitgeschreven — met formules en voorbeelden — op de{" "}
            <Link href="/info">uitlegpagina</Link>.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-neutral-700)", margin: 0 }}>
            En je hoeft niet te kiezen tussen partners: speel met meerdere vaste duo&apos;s tegelijk,
            elk met hun eigen plek op de ladder.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section
        style={{
          position: "relative",
          padding: "clamp(64px,10vw,120px) clamp(20px,4vw,48px)",
          backgroundImage: "url(/images/court-lines.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderTop: "2px solid var(--color-divider)",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            textAlign: "center",
            background: "var(--color-bg)",
            padding: "clamp(32px,5vw,56px)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "clamp(24px,3.2vw,32px)",
              margin: "0 0 12px",
            }}
          >
            Klaar om te klimmen?
          </h2>
          <p style={{ fontSize: 15, color: "var(--color-neutral-700)", margin: "0 0 24px" }}>
            Maak een account aan, vorm een duo, en klim vanaf je eerste wedstrijd mee op de ladder.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn btn-primary">
              Account aanmaken
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Ik heb al een account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
