"use client";

/**
 * @author: @kokonut-labs
 * @description: Slide Text Button with animated vertical text transition
 * @version: 1.0.0
 * @date: 2025-11-02
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Aangepast voor Padel Ladder:
 * - geen entree-animatie (schoof 200px in bij elke mount)
 * - varianten op Court-tokens: "primary" | "ball" | "outline"
 * - pure CSS (hover/focus-visible), respecteert prefers-reduced-motion
 * - de verborgen tweede tekst is aria-hidden (geen dubbele voorleestekst)
 *
 * Bedoeld voor 1 marketing-CTA (landing/login). Op touch-apparaten is het
 * gewoon een knop; het hover-effect is progressive enhancement.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SlideTextButtonProps extends Omit<React.ComponentProps<typeof Link>, "children"> {
  text: string;
  hoverText?: string;
  variant?: "primary" | "ball" | "outline";
}

const variantStyles = {
  primary: "bg-primary text-primary-foreground",
  ball: "bg-ball text-ball-foreground",
  outline: "border border-current/25 text-current hover:bg-current/5",
} as const;

export default function SlideTextButton({
  text,
  hoverText,
  className,
  variant = "primary",
  ...props
}: SlideTextButtonProps) {
  const slideText = hoverText ?? text;

  return (
    <Link
      className={cn(
        "group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-lg px-7 text-base font-semibold no-underline transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <span className="relative inline-block transition-transform duration-300 ease-snap group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none">
        <span className="flex items-center gap-2 transition-opacity duration-300 group-hover:opacity-0 group-focus-visible:opacity-0">
          {text}
        </span>
        <span
          aria-hidden
          className="absolute top-full left-0 flex w-full items-center justify-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {slideText}
        </span>
      </span>
    </Link>
  );
}
