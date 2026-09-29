import { History, LineChart, Swords } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DuoSection = "challenges" | "matches" | "rating-history";

const SECTIONS: { value: DuoSection; label: string; icon: typeof Swords }[] = [
  { value: "challenges", label: "Challenges", icon: Swords },
  { value: "matches", label: "Wedstrijden", icon: History },
  { value: "rating-history", label: "Rating", icon: LineChart },
];

/**
 * Navigatie tussen de onderdelen van één duo (challenges, wedstrijden,
 * rating). `own={false}` verbergt Challenges — die zijn alleen voor leden.
 */
export function DuoSectionNav({
  duoId,
  current,
  own = true,
  className,
}: {
  duoId: string;
  current: DuoSection;
  own?: boolean;
  className?: string;
}) {
  const sections = own ? SECTIONS : SECTIONS.filter((s) => s.value !== "challenges");
  return (
    <nav aria-label="Onderdelen van dit duo" className={cn("-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-1 border-b">
        {sections.map(({ value, label, icon: Icon }) => {
          const active = value === current;
          return (
            <li key={value}>
              <Link
                href={`/duos/${duoId}/${value}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative -mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold no-underline transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
