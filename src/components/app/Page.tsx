import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const widths = {
  narrow: "max-w-md", // formulieren: login, registreren, duo voorstellen
  default: "max-w-3xl", // lijsten, detail
  wide: "max-w-6xl", // dashboards, tabellen met veel kolommen
} as const;

/**
 * Root van elke geherontworpen pagina.
 * - Zet `data-kit` → schakelt de legacy element-defaults uit en zet dark mode
 *   aan voor deze pagina (zie globals.css / legacy.css).
 * - Consistente zijmarges (16px mobiel, 24px ≥ sm, 32px ≥ lg) en verticale ritmiek.
 *
 *   export default function LadderPage() {
 *     return (
 *       <Page>
 *         <PageHeader title="Ladder" description="…" />
 *         …
 *       </Page>
 *     );
 *   }
 */
export function Page({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: keyof typeof widths;
  className?: string;
}) {
  return (
    <main
      data-kit
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 pt-5 pb-10 text-[0.9375rem] sm:px-6 sm:pt-8 lg:px-8 lg:pt-10",
        widths[width],
        className,
      )}
    >
      {children}
    </main>
  );
}
