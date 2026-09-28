"use client";

import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { EASE_SNAP } from "./motion";

// Standaard zonder duizendtalscheiding: een rating "1.395" leest in NL als decimaal.
const defaultFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0, useGrouping: false });

/**
 * Getal dat soepel naar een nieuwe waarde telt (ratings, posities, tellers).
 * - Eerste render (en SSR) toont direct de eindwaarde — geen layout-shift, geen
 *   "0 → 1234"-gimmick — tenzij `animateOnMount`.
 * - Altijd tabular figures; screenreaders krijgen alleen de eindwaarde.
 * - prefers-reduced-motion: springt direct naar de nieuwe waarde.
 */
export function AnimatedNumber({
  value,
  format = defaultFormat.format,
  animateOnMount = false,
  duration = 0.6,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  /** Tel bij de eerste mount op vanaf 0 (spaarzaam: één hero-getal per pagina). */
  animateOnMount?: boolean;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(animateOnMount && !reduceMotion ? 0 : value);
  const text = useTransform(motionValue, (latest) => format(Math.round(latest)));
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: EASE_SNAP });
    return () => controls.stop();
  }, [value, duration, reduceMotion, motionValue]);

  return (
    <span className={cn("tabular", className)}>
      <m.span aria-hidden>{text}</m.span>
      <span className="sr-only">{formatRef.current(value)}</span>
    </span>
  );
}
