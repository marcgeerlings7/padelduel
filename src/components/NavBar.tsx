"use client";

import {
  CalendarClock,
  CircleHelp,
  Ellipsis,
  Gavel,
  KeyRound,
  LogIn,
  LogOut,
  SlidersHorizontal,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLockup, BrandMark } from "@/components/app/BrandMark";
import SwitchButton from "@/components/kokonutui/switch-button";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { clearStoredToken, getStoredRole, getStoredToken } from "@/lib/client/session";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Linkteksten en hrefs zijn ongewijzigd t.o.v. de Modernist-NavBar
// (e2e-selectors en gebruikersgewoontes).
const NAV_LINKS: NavLink[] = [
  { href: "/ladder", label: "Ladder", icon: Trophy },
  { href: "/dashboard", label: "Mijn duo's", icon: Users },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/rating-history", label: "Rating", icon: TrendingUp },
  { href: "/availability", label: "Beschikbaarheid", icon: CalendarClock },
  { href: "/info", label: "Uitleg", icon: CircleHelp },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/disputes", label: "Disputes", icon: Gavel },
  { href: "/admin/api-clients", label: "API-clients", icon: KeyRound },
  { href: "/admin/platform-config", label: "Platform config", icon: SlidersHorizontal },
];

/** Tabs die op mobiel direct in de onderbalk staan; de rest zit onder "Meer". */
const PRIMARY_TAB_COUNT = 4;

function isActive(pathname: string | null, href: string) {
  return Boolean(pathname && (pathname === href || pathname.startsWith(`${href}/`)));
}

/**
 * App-shell-navigatie.
 * - < lg: compacte app-bar bovenin + vaste tab-bar onderin (4 tabs + "Meer"-sheet).
 * - ≥ lg: vaste zijbalk links (de layout reserveert lg:pl-64).
 * Beide varianten staan in de DOM; de verborgen variant is display:none en
 * dus ook uit de toegankelijkheidsboom.
 */
export function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Herevalueren bij elke client-side navigatie (bijv. login -> /dashboard),
  // anders blijft de nav de status van vóór het inloggen tonen totdat de
  // pagina hard herladen wordt.
  useEffect(() => {
    setLoggedIn(Boolean(getStoredToken()));
    setIsAdmin(getStoredRole() === "ADMIN");
    setMoreOpen(false);
  }, [pathname]);

  const logout = () => {
    clearStoredToken();
    setLoggedIn(false);
    window.location.href = "/";
  };

  const primaryTabs = NAV_LINKS.slice(0, PRIMARY_TAB_COUNT);
  const moreLinks = NAV_LINKS.slice(PRIMARY_TAB_COUNT);
  const moreActive = [...moreLinks, ...(isAdmin ? ADMIN_LINKS : [])].some((l) => isActive(pathname, l.href));

  const accountAction = loggedIn ? (
    <Button type="button" variant="ghost" size="sm" onClick={logout}>
      <LogOut aria-hidden />
      Uitloggen
    </Button>
  ) : (
    <Button asChild variant="soft" size="sm">
      <Link href="/login">
        <LogIn aria-hidden />
        Inloggen
      </Link>
    </Button>
  );

  return (
    <div data-app-shell>
      {/* ── Desktop: zijbalk ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
        <Link
          href="/"
          className="flex h-16 items-center px-5 text-foreground no-underline focus-visible:outline-offset-[-2px]"
        >
          <BrandLockup />
        </Link>
        <nav aria-label="Hoofdnavigatie" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          <SideGroup links={NAV_LINKS} pathname={pathname} groupId="main" />
          {isAdmin ? (
            <div className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Beheer</p>
              <SideGroup links={ADMIN_LINKS} pathname={pathname} groupId="admin" />
            </div>
          ) : null}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t p-3">
          {accountAction}
          <SwitchButton size="icon" showLabel={false} />
        </div>
      </aside>

      {/* ── Mobiel: app-bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-foreground no-underline" aria-label="Padel Ladder — home">
          <BrandMark className="size-7" />
          <span className="font-display text-xl leading-none font-bold">Padel Ladder</span>
        </Link>
        <div className="flex items-center gap-1.5">{accountAction}</div>
      </header>

      {/* ── Mobiel: tab-bar ──────────────────────────────────────────── */}
      <nav
        aria-label="Tabbladen"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe shadow-nav backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {primaryTabs.map((link) => (
            <li key={link.href}>
              <TabLink link={link} active={isActive(pathname, link.href)} />
            </li>
          ))}
          <li>
            <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
              <DrawerTrigger asChild>
                <button type="button" className={tabClass(moreActive)} aria-current={moreActive ? "page" : undefined}>
                  <TabIcon icon={Ellipsis} active={moreActive} />
                  <span>Meer</span>
                </button>
              </DrawerTrigger>
              <DrawerContent className="px-4">
                <DrawerHeader className="px-1 text-left">
                  <DrawerTitle className="font-display text-2xl font-bold">Meer</DrawerTitle>
                  <DrawerDescription className="sr-only">Overige pagina&apos;s en instellingen</DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col gap-5 pb-4">
                  <SheetLinks links={moreLinks} pathname={pathname} />
                  {isAdmin ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="px-1 text-xs font-semibold text-muted-foreground">Beheer</p>
                      <SheetLinks links={ADMIN_LINKS} pathname={pathname} />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
                    <span className="text-sm font-medium">Weergave</span>
                    <SwitchButton size="sm" />
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    "relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold no-underline transition-colors",
    "focus-visible:outline-offset-[-4px]",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span className="relative flex h-7 w-12 items-center justify-center">
      {active ? (
        <m.span
          layoutId="tab-indicator"
          className="absolute inset-0 rounded-full bg-ball"
          transition={{ type: "spring", stiffness: 600, damping: 40 }}
        />
      ) : null}
      <Icon
        aria-hidden
        className={cn("relative size-5", active && "text-ball-foreground")}
        strokeWidth={active ? 2.4 : 2}
      />
    </span>
  );
}

function TabLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link href={link.href} className={tabClass(active)} aria-current={active ? "page" : undefined}>
      <TabIcon icon={link.icon} active={active} />
      <span className="max-w-full truncate px-0.5">{link.label}</span>
    </Link>
  );
}

function SideGroup({ links, pathname, groupId }: { links: NavLink[]; pathname: string | null; groupId: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium no-underline transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {active ? (
                <m.span
                  layoutId={`side-indicator-${groupId}`}
                  className="absolute inset-0 rounded-md bg-primary-soft"
                  transition={{ type: "spring", stiffness: 600, damping: 45 }}
                />
              ) : null}
              <Icon aria-hidden className="relative size-[18px]" />
              <span className="relative">{link.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SheetLinks({ links, pathname }: { links: NavLink[]; pathname: string | null }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <li key={link.href} className="border-b last:border-b-0">
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 px-4 text-[15px] font-medium no-underline",
                active ? "text-primary" : "text-foreground active:bg-accent",
              )}
            >
              <Icon aria-hidden className="size-5 text-muted-foreground" />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
