"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const DESKTOP_QUERY = "(min-width: 640px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** true vanaf de sm-breakpoint; op de server (en bij de eerste render) mobiel. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Bottom sheet op mobiel (vaul-drawer), gecentreerde dialog vanaf sm.
 * Controlled. `children` bevat de volledige inhoud inclusief eigen knoppen,
 * zodat een `<form>` de submit-knop kan omvatten.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="font-display text-2xl leading-tight font-bold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-lg px-5">
        <DrawerHeader className="gap-1 px-0 pt-5 text-left!">
          <DrawerTitle className="font-display text-2xl leading-tight font-bold">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-sm text-muted-foreground">{description}</DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="pb-5">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
