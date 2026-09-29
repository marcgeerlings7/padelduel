"use client";

import type { ReactNode } from "react";
import { ResponsiveSheet } from "@/components/availability/ResponsiveSheet";
import { Button } from "@/components/ui/button";

/**
 * Bevestiging voor een ingrijpende beheeractie: bottom sheet op mobiel,
 * dialog vanaf sm. De bevestigknop herhaalt het werkwoord van de actie.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-col gap-5">
        {children}
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button
            type="button"
            size="lg"
            variant={tone === "destructive" ? "destructive" : "default"}
            className="sm:flex-1"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
          <Button type="button" size="lg" variant="outline" className="sm:flex-1" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
