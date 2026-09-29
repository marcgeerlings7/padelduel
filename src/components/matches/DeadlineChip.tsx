import { AlarmClock, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { deadlineUrgency, formatDateTime, formatRelative } from "./time";

/**
 * Deadline als relatieve tijd ("nog over 2 dagen") met urgentie-styling:
 * < 3 dagen amber, < 24 uur amber + wekker, verlopen rood. Het absolute
 * tijdstip staat in <time dateTime> en in de title.
 */
export function DeadlineChip({
  deadline,
  prefix,
  now,
  className,
}: {
  deadline: string | Date;
  /** Tekst vóór de relatieve tijd, bijv. "Reageer". */
  prefix: ReactNode;
  now?: Date;
  className?: string;
}) {
  const urgency = deadlineUrgency(deadline, now);
  const Icon = urgency === "urgent" || urgency === "overdue" ? AlarmClock : Clock;
  const iso = new Date(deadline).toISOString();
  const absolute = formatDateTime(deadline);

  return (
    <p
      data-urgency={urgency}
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        urgency === "normal" && "bg-muted text-muted-foreground",
        (urgency === "soon" || urgency === "urgent") && "bg-warning-soft text-warning",
        urgency === "urgent" && "font-semibold",
        urgency === "overdue" && "bg-loss-soft text-loss",
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className={cn("min-w-0 truncate", className)}>
        {prefix}{" "}
        <time dateTime={iso} title={absolute}>
          {formatRelative(deadline, now)}
        </time>
        <span className="sr-only"> ({absolute})</span>
      </span>
    </p>
  );
}
