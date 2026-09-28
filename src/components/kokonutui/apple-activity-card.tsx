"use client";

/**
 * @author: @kokonutui
 * @description: Apple Activity Card
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Aangepast voor Padel Ladder: data-gedreven concentrische voortgangsringen
 * (geen hardcoded Move/Exercise/Stand-demo), kleuren via Court-tokens, geen
 * gradients/drop-shadows, toegankelijk (role="img" + samenvattend label),
 * `size` instelbaar. Legenda staat naast de ringen (onder op < sm).
 *
 * Voorbeeld — speelverplichting + winstpercentage:
 *   <ActivityRings rings={[
 *     { label: "Gespeeld deze maand", current: 2, target: 3, color: "var(--primary)" },
 *     { label: "Winstpercentage", current: 64, target: 100, unit: "%", color: "var(--win)" },
 *   ]} />
 */

import { m } from "motion/react";
import { cn } from "@/lib/utils";

export interface ActivityRing {
  label: string;
  current: number;
  target: number;
  /** CSS-kleur, bij voorkeur een token: "var(--primary)", "var(--win)", "var(--ball)". */
  color: string;
  unit?: string;
}

interface ActivityRingsProps {
  rings: ActivityRing[];
  /** Diameter van de buitenste ring in px. */
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  className?: string;
}

export default function ActivityRings({
  rings,
  size = 132,
  strokeWidth = 12,
  showLegend = true,
  className,
}: ActivityRingsProps) {
  const gap = 3;
  const summary = rings.map((r) => `${r.label}: ${r.current}${r.unit ?? ""} van ${r.target}${r.unit ?? ""}`).join(", ");

  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:gap-6", className)}>
      <svg
        role="img"
        aria-label={summary}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
      >
        {rings.map((ring, index) => {
          const radius = size / 2 - strokeWidth / 2 - index * (strokeWidth + gap);
          if (radius <= strokeWidth / 2) return null;
          const circumference = 2 * Math.PI * radius;
          const ratio = ring.target > 0 ? Math.min(Math.max(ring.current / ring.target, 0), 1) : 0;
          return (
            <g key={ring.label}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeOpacity={0.16}
                strokeWidth={strokeWidth}
              />
              <m.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - ratio) }}
                transition={{ duration: 0.9, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </g>
          );
        })}
      </svg>
      {showLegend ? (
        <dl className="grid gap-3">
          {rings.map((ring) => (
            <div key={ring.label} className="flex flex-col">
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span aria-hidden className="size-2 rounded-full" style={{ background: ring.color }} />
                {ring.label}
              </dt>
              <dd className="font-score text-2xl">
                {ring.current}
                <span className="text-base text-muted-foreground">
                  /{ring.target}
                  {ring.unit}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
