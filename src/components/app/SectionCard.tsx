import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Een inhoudsblok met optionele kop (h2), beschrijving en actie rechtsboven.
 * - variant "default": wit/card-oppervlak — de standaard voor secties.
 * - variant "court": diep baanblauw met baanlijnen — max. één per pagina,
 *   voor het belangrijkste blok (bijv. "jouw duo" op het dashboard).
 * - variant "plain": geen kader, alleen kop + content (lijsten die zelf al kaarten zijn).
 * `flush` haalt de binnenpadding weg voor tabellen/lijsten die tot de rand lopen.
 * `as="section"` (default) — geef `aria-labelledby` automatisch via `id`.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  variant = "default",
  flush = false,
  id,
  className,
  headingLevel = 2,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  variant?: "default" | "court" | "plain";
  flush?: boolean;
  id?: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-title` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={title && headingId ? headingId : undefined}
      className={cn(
        "flex flex-col",
        variant === "default" && "rounded-xl border bg-card text-card-foreground shadow-card",
        variant === "court" &&
          "court-lines relative overflow-hidden rounded-2xl bg-court text-court-foreground shadow-raised",
        variant !== "plain" && !flush && "p-4 sm:p-5",
        variant === "plain" && "gap-3",
        className,
      )}
    >
      {title || action ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3",
            variant !== "plain" && (flush ? "px-4 pt-4 pb-3 sm:px-5 sm:pt-5" : "pb-3"),
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <Heading id={headingId} className="font-display text-[1.375rem] leading-tight font-bold">
                {title}
              </Heading>
            ) : null}
            {description ? (
              <p className={cn("text-sm", variant === "court" ? "text-court-muted" : "text-muted-foreground")}>
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
