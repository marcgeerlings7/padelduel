"use client";

import { Gavel, KeyRound, SlidersHorizontal, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/disputes", label: "Disputes", icon: Gavel },
  { href: "/admin/api-clients", label: "API-clients", icon: KeyRound },
  { href: "/admin/platform-config", label: "Platform config", icon: SlidersHorizontal },
  { href: "/admin/users", label: "Gebruikers", icon: UserCog },
] as const;

/** Sub-navigatie tussen de beheerpagina's (horizontaal scrollbaar op mobiel). */
export function AdminNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  // Op mobiel het actieve item in beeld schuiven (de lijst scrollt horizontaal).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav aria-label="Beheer" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-xl border bg-card p-1 shadow-card">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap no-underline transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/60",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
