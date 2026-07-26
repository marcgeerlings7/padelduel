"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredToken, clearStoredToken } from "@/lib/client/session";

export function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  // Herevalueren bij elke client-side navigatie (bijv. login -> /dashboard),
  // anders blijft de nav de status van vóór het inloggen tonen totdat de
  // pagina hard herladen wordt.
  useEffect(() => {
    setLoggedIn(Boolean(getStoredToken()));
  }, [pathname]);

  return (
    <nav className="flex flex-wrap items-center gap-4 border-b border-black/10 px-4 py-3 text-sm dark:border-white/20 sm:px-8">
      <Link href="/" className="font-semibold">
        Padel Ladder
      </Link>
      <Link href="/ladder" className="hover:underline">
        Ladder
      </Link>
      <Link href="/dashboard" className="hover:underline">
        Dashboard
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {loggedIn ? (
          <button
            type="button"
            onClick={() => {
              clearStoredToken();
              setLoggedIn(false);
              window.location.href = "/";
            }}
            className="hover:underline"
          >
            Uitloggen
          </button>
        ) : (
          <Link href="/login" className="hover:underline">
            Inloggen
          </Link>
        )}
      </div>
    </nav>
  );
}
