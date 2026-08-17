import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        minHeight: "calc(100vh - 64px)",
      }}
      className="lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.2fr)]"
    >
      <div
        className="hidden lg:flex"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(20,20,20,0.88), rgba(20,20,20,0.96)), url(/images/court-lines.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "var(--color-bg)",
          padding: "clamp(32px,6vw,80px)",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "2px solid var(--color-divider)",
        }}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, letterSpacing: "0.04em" }}>
          PADEL LADDER
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "clamp(36px,6vw,72px)",
              lineHeight: 0.95,
              textTransform: "uppercase",
            }}
          >
            Klim de
            <br />
            ladder.
          </div>
          <p style={{ fontSize: "clamp(15px,1.6vw,18px)", maxWidth: "32ch", marginTop: 16, opacity: 0.85 }}>
            Daag duo&apos;s uit binnen jouw tier. Speel de wedstrijd. Zie je rating stijgen.
          </p>
        </div>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Seizoen 2026 — Tier 1 t/m 6</div>
      </div>

      <div className="flex items-center justify-center" style={{ padding: "clamp(24px,5vw,64px)" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
      </div>
    </div>
  );
}
