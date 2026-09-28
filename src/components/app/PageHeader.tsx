import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Paginatitel (de enige <h1>) + optionele beschrijving, terug-link en acties.
 * Acties staan op mobiel onder de titel (volle breedte mogelijk), vanaf sm rechts.
 *
 *   <PageHeader
 *     title="Mijn duo's"
 *     description="Je actieve duo's, openstaande uitnodigingen en speelverplichting."
 *     back={{ href: "/dashboard", label: "Dashboard" }}
 *     actions={<Button asChild><Link href="/duos/propose">Vorm een duo</Link></Button>}
 *   />
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  /** Kleine regel onder de titel, bijv. een badge-rij (regio, tier). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {back ? (
          <Link
            href={back.href}
            className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-sm text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-[2.125rem] leading-[0.95] font-bold tracking-tight text-balance sm:text-[2.75rem]">
          {title}
        </h1>
        {description ? <p className="max-w-prose text-[0.9375rem] text-muted-foreground">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
