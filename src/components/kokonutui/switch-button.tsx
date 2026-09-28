"use client";

/**
 * @author: @dorianbaffier
 * @description: Switch Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Aangepast voor Padel Ladder:
 * - resolvedTheme i.p.v. theme (theme kan "system" zijn → toggle deed dan niets zinnigs)
 * - geen hydration-mismatch: icoon/label pas na mount bepalen
 * - Court-tokens i.p.v. zinc/amber, Nederlandse labels, aria-label + aria-pressed
 * - maat "icon" voor de app-bar; shimmer-sweep behouden (alleen op hover)
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SwitchButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  size?: "icon" | "sm" | "default";
  showLabel?: boolean;
}

export default function SwitchButton({ className, size = "default", showLabel = true, ...props }: SwitchButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Licht thema" : "Donker thema";

  return (
    <Button
      type="button"
      variant="outline"
      size={size === "icon" ? "icon" : size === "sm" ? "sm" : "default"}
      aria-label={showLabel && size !== "icon" ? undefined : label}
      aria-pressed={mounted ? isDark : undefined}
      className={cn("group relative overflow-hidden", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      {...props}
    >
      <span className="relative flex items-center gap-2">
        {isDark ? (
          <Moon className="transition-transform duration-500 ease-snap group-hover:-rotate-12" aria-hidden />
        ) : (
          <Sun className="text-warning transition-transform duration-700 ease-snap group-hover:rotate-90" aria-hidden />
        )}
        {showLabel && size !== "icon" ? <span>{label}</span> : null}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent transition-transform duration-500 group-hover:translate-x-full"
      />
    </Button>
  );
}
