import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Laadtoestanden die de échte layout nabootsen (geen spinners voor content).
 * Elk skeleton is een role="status"-regio met sr-only "Laden…".
 */
function Status({ label = "Laden…", className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Lijst met avatar + twee regels + waarde rechts (ladder, challenges, duo's). */
export function ListSkeleton({ rows = 5, label, className }: { rows?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </Status>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 4,
  label,
  className,
}: {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Status label={label} className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b px-4 py-3.5 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </Status>
  );
}

export function CardSkeleton({ lines = 3, label, className }: { lines?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </Status>
  );
}

export function StatGridSkeleton({ count = 4, label, className }: { count?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ))}
    </Status>
  );
}

export function ChartSkeleton({ aspectRatio = "2 / 1", label, className }: { aspectRatio?: string; label?: string; className?: string }) {
  return (
    <Status label={label ?? "Grafiek laden…"} className={className}>
      <Skeleton className="w-full rounded-lg" style={{ aspectRatio }} />
    </Status>
  );
}
