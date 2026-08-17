"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredToken, getStoredRole, clearStoredToken } from "@/lib/client/session";

const NAV_LINKS = [
  { href: "/ladder", label: "Ladder" },
  { href: "/dashboard", label: "Mijn duo's" },
  { href: "/challenges", label: "Challenges" },
  { href: "/rating-history", label: "Rating" },
  { href: "/availability", label: "Beschikbaarheid" },
  { href: "/info", label: "Uitleg" },
];

const ADMIN_LINKS = [
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/api-clients", label: "API-clients" },
  { href: "/admin/platform-config", label: "Platform config" },
];

export function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Herevalueren bij elke client-side navigatie (bijv. login -> /dashboard),
  // anders blijft de nav de status van vóór het inloggen tonen totdat de
  // pagina hard herladen wordt.
  useEffect(() => {
    setLoggedIn(Boolean(getStoredToken()));
    setIsAdmin(getStoredRole() === "ADMIN");
  }, [pathname]);

  const links = isAdmin ? [...NAV_LINKS, ...ADMIN_LINKS] : NAV_LINKS;

  return (
    <nav className="nav flex flex-wrap items-center gap-1">
      <Link href="/" className="nav-brand">
        PADEL LADDER
      </Link>
      <div className="flex flex-wrap">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.02em",
                padding: "20px 14px",
                color: active ? "var(--color-accent-700)" : "var(--color-text)",
                borderBottom: active ? "3px solid var(--color-accent)" : "3px solid transparent",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-4">
        {loggedIn ? (
          <button
            type="button"
            onClick={() => {
              clearStoredToken();
              setLoggedIn(false);
              window.location.href = "/";
            }}
            className="btn btn-ghost"
          >
            Uitloggen
          </button>
        ) : (
          <Link href="/login" className="btn btn-ghost">
            Inloggen
          </Link>
        )}
      </div>
    </nav>
  );
}
