import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Foutmelding-blok (role="alert") in Court-stijl. */
export function AdminAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss", className)}>
      {children}
    </div>
  );
}
