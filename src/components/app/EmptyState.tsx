import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lege toestand: zegt wat er (nog) niet is én wat de gebruiker nu kan doen.
 * Titel = feitelijke toestand ("Nog geen challenges"), beschrijving = waarom /
 * wat er gebeurt, `action` = de volgende stap (één primaire Button).
 *
 *   <EmptyState icon={Swords} title="Nog geen challenges"
 *     description="Daag een duo uit dat binnen jouw tier-bereik staat."
 *     action={<Button asChild><Link href="/ladder">Naar de ladder</Link></Button>} />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Kleinere variant binnen een SectionCard. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon aria-hidden className="size-6" />
        </span>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-xl leading-tight font-bold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
