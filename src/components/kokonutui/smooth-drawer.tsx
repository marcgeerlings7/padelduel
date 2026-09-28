"use client";

/**
 * @author: @dorianbaffier
 * @description: Smooth Drawer
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Aangepast voor Padel Ladder: de demo (prijskaartje, hardcoded CTA) is vervangen
 * door een generieke bottom-sheet voor mobiele acties. Behouden: vaul-drawer met
 * veer-animatie en gestaggerde content-reveal. Controlled óf uncontrolled.
 *
 *   <SmoothDrawer
 *     trigger={<Button>Uitdagen</Button>}
 *     title="Smash Sisters uitdagen?"
 *     description="Ze hebben 72 uur om te reageren."
 *     footer={<Button size="lg" onClick={send}>Verstuur uitdaging</Button>}
 *   >
 *     …optionele extra content…
 *   </SmoothDrawer>
 */

import { m, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 34 } },
};

interface SmoothDrawerProps {
  /** Element dat de drawer opent (wordt `asChild` gebruikt — geef een Button). */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Primaire actie(s). Een "Annuleren"-knop wordt automatisch toegevoegd. */
  footer?: ReactNode;
  cancelLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export default function SmoothDrawer({
  trigger,
  title,
  description,
  children,
  footer,
  cancelLabel = "Annuleren",
  open,
  onOpenChange,
  className,
}: SmoothDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent className={cn("mx-auto w-full max-w-lg px-5 pt-2", className)}>
        <m.div animate="visible" className="flex flex-col gap-5 pt-2" initial="hidden" variants={containerVariants}>
          <DrawerHeader className="gap-1.5 px-0 text-left">
            <m.div variants={itemVariants}>
              <DrawerTitle className="font-display text-2xl leading-tight font-bold">{title}</DrawerTitle>
            </m.div>
            {description ? (
              <m.div variants={itemVariants}>
                <DrawerDescription className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </DrawerDescription>
              </m.div>
            ) : null}
          </DrawerHeader>
          {children ? <m.div variants={itemVariants}>{children}</m.div> : null}
          <m.div variants={itemVariants}>
            <DrawerFooter className="gap-2.5 px-0 pb-5">
              {footer}
              <DrawerClose asChild>
                <Button size="lg" variant="outline">
                  {cancelLabel}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </m.div>
        </m.div>
      </DrawerContent>
    </Drawer>
  );
}
