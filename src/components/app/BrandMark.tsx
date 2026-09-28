import { cn } from "@/lib/utils";

/**
 * Merkteken: een padelbaan van bovenaf (net + middenlijn) met de bal in
 * optic-geel — bewust minimaal zodat hij op 24–32px scherp blijft.
 * Puur SVG, geen client-JS; kleuren via --court en --ball.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="1.5" y="4.5" width="29" height="23" rx="6" fill="var(--court)" />
      <path d="M16 4.5v23" stroke="#fff" strokeWidth="2" />
      <path d="M6.5 16h19" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="23" cy="10.5" r="3.5" fill="var(--ball)" />
    </svg>
  );
}

/** Merkteken + woordmerk. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-display text-[1.375rem] leading-none font-bold tracking-tight">Padel Ladder</span>
    </span>
  );
}
