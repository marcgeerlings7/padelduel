import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bouwstenen voor /info (server components, geen client-JS):
 * uitklapblokken op basis van native <details>, formules en getallen.
 */

export function InfoSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  /** Eén of twee zinnen: de kern, zonder uitklappen leesbaar. */
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-20 flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:p-5 lg:scroll-mt-6"
    >
      <h2 id={`${id}-title`} className="font-display text-[1.5rem] leading-tight font-bold">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed [&_strong]:font-semibold">{lead}</div>
      {children}
    </section>
  );
}

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border bg-background/60 [&[open]]:bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold select-none hover:bg-accent [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 border-t px-3 py-3 text-sm leading-relaxed [&_strong]:font-semibold">
        {children}
      </div>
    </details>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md bg-muted px-3 py-2.5">
      <p className="font-display text-[1.0625rem] leading-snug font-semibold tracking-wide">
        {children}
      </p>
    </div>
  );
}

export function BulletList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("flex list-disc flex-col gap-1.5 pl-5 marker:text-primary", className)}>{children}</ul>
  );
}

/** Een configuratiegetal; "—" als de instellingen niet geladen konden worden. */
export function Num({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) return <strong>—</strong>;
  const text = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2, useGrouping: false }).format(value);
  return (
    <strong className="tabular">
      {text}
      {unit ? ` ${unit}` : ""}
    </strong>
  );
}
