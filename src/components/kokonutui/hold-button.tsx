"use client";

/**
 * @author: @dorianbaffier
 * @description: Hold Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Aangepast voor Padel Ladder (de Kokonut-versie was een demo zonder callback):
 * - `onConfirm` wordt aangeroepen zodra de knop `holdDuration` ms is vastgehouden
 * - werkt met muis, touch (pointer events) én toetsenbord (Spatie/Enter vasthouden)
 * - `children` = label; `holdingLabel` tijdens het vasthouden
 * - tones op Court-tokens: "destructive" | "primary" | "neutral"
 * - reduced motion: vulling springt niet, maar loopt lineair (functioneel nodig)
 *
 * Gebruik voor onomkeerbare acties waar een extra dialoog te zwaar is, bijv.
 * "Duo opheffen", "Uitslag bevestigen". Zie docs/Design_System.md §5.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { m, useAnimation } from "motion/react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const holdButtonVariants = cva("relative min-w-40 touch-none overflow-hidden select-none", {
  variants: {
    tone: {
      destructive: "border border-loss/30 bg-loss-soft text-loss hover:bg-loss-soft",
      primary: "border border-primary/30 bg-primary-soft text-primary hover:bg-primary-soft",
      neutral: "border border-border bg-muted text-foreground hover:bg-muted",
    },
  },
  defaultVariants: { tone: "destructive" },
});

const fillByTone = {
  destructive: "bg-loss/20",
  primary: "bg-primary/20",
  neutral: "bg-foreground/10",
} as const;

interface HoldButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick">,
    VariantProps<typeof holdButtonVariants> {
  /** Aangeroepen na volledig vasthouden. */
  onConfirm: () => void;
  /** Duur in ms. Standaard 1200 — lang genoeg tegen misclicks, kort genoeg voor mobiel. */
  holdDuration?: number;
  children: ReactNode;
  holdingLabel?: ReactNode;
  icon?: ReactNode;
}

export default function HoldButton({
  className,
  tone = "destructive",
  holdDuration = 1200,
  onConfirm,
  children,
  holdingLabel = "Blijf vasthouden…",
  icon,
  disabled,
  ...props
}: HoldButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const controls = useAnimation();
  const holdingRef = useRef(false);

  const start = useCallback(async () => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setIsHolding(true);
    controls.set({ width: "0%" });
    await controls.start({ width: "100%", transition: { duration: holdDuration / 1000, ease: "linear" } });
    // start() resolved ook na stop(); alleen bevestigen als er nog steeds wordt vastgehouden.
    if (holdingRef.current) {
      holdingRef.current = false;
      setIsHolding(false);
      controls.set({ width: "0%" });
      onConfirm();
    }
  }, [controls, disabled, holdDuration, onConfirm]);

  const cancel = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setIsHolding(false);
    controls.stop();
    void controls.start({ width: "0%", transition: { duration: 0.12 } });
  }, [controls]);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(holdButtonVariants({ tone }), className)}
      onPointerDown={(e) => {
        if (e.button === 0) void start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          void start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-description={`Houd ${Math.round(holdDuration / 100) / 10} seconden ingedrukt om te bevestigen`}
      {...props}
    >
      <m.span
        aria-hidden
        animate={controls}
        initial={{ width: "0%" }}
        className={cn("absolute inset-y-0 left-0", fillByTone[tone ?? "destructive"])}
      />
      <span className="relative z-10 flex w-full items-center justify-center gap-2" aria-live="polite">
        {icon}
        {isHolding ? holdingLabel : children}
      </span>
    </Button>
  );
}
