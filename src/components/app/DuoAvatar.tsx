import { cn } from "@/lib/utils";
import { duoInitials } from "./format";

// Vaste set "clubkleuren" — elk ≥4.5:1 met witte tekst, werkt op licht én donker.
const SWATCHES = ["#1f45c8", "#0f766e", "#15803d", "#b45309", "#be123c", "#334155", "#0e7490"] as const;

const sizes = {
  sm: "size-8 text-sm rounded-md",
  md: "size-10 text-base rounded-lg",
  lg: "size-14 text-2xl rounded-xl",
} as const;

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Duo-"clubwapen": initialen op een deterministische clubkleur (zelfde naam →
 * zelfde kleur, overal). Decoratief naast de duonaam → standaard aria-hidden;
 * geef `label` mee als het avatar alléén staat.
 * `own`: markeert een eigen duo met een ball-gele ring.
 */
export function DuoAvatar({
  name,
  size = "md",
  own = false,
  label,
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  own?: boolean;
  label?: string;
  className?: string;
}) {
  const color = SWATCHES[hash(name) % SWATCHES.length];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ backgroundColor: color }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-display leading-none font-bold text-white select-none",
        sizes[size],
        own && "ring-2 ring-ball ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {duoInitials(name)}
    </span>
  );
}
