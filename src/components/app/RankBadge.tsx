import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-7 min-w-7 px-1.5 text-base rounded-md",
  md: "h-9 min-w-9 px-2 text-xl rounded-lg",
  lg: "h-14 min-w-14 px-3 text-4xl rounded-xl",
} as const;

/**
 * Ladderpositie als scorebord-cijfer. #1 krijgt het ball-geel (de enige
 * plek waar geel "vanzelf" verschijnt), #2–3 getint primair, de rest neutraal.
 * Positie is altijd afgeleid (RANK()) — geef hem door zoals de API hem levert.
 */
export function RankBadge({
  position,
  size = "md",
  className,
}: {
  position: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-label={`Positie ${position}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-score",
        sizes[size],
        position === 1 && "bg-ball text-ball-foreground",
        (position === 2 || position === 3) && "bg-primary-soft text-primary",
        position > 3 && "bg-muted text-foreground",
        className,
      )}
    >
      {position}
    </span>
  );
}
