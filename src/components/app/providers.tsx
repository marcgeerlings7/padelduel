"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Globale client-providers voor de hele app (gemount in de root layout):
 * - next-themes: `.dark` op <html>, standaard volgens prefers-color-scheme.
 * - MotionConfig reducedMotion="user": respecteert prefers-reduced-motion
 *   (transform-animaties vallen weg, opacity blijft).
 * - LazyMotion(domMax): features één keer laden; gebruik in app-code `m.*`
 *   i.p.v. `motion.*` waar mogelijk (kleinere bundle per component).
 * - TooltipProvider + Toaster (sonner): één instantie voor de hele app.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}>
        <LazyMotion features={domMax}>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster position="top-center" closeButton />
          </TooltipProvider>
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  );
}
