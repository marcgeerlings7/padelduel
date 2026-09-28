"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/client/session";

/**
 * Stuurt een ingelogde bezoeker door naar /dashboard.
 *
 * Twee lagen, zodat de publieke pagina gewoon server-side gerenderd kan
 * worden (geen lege pagina tot de JS geladen is) zonder dat ingelogde
 * gebruikers de marketingpagina zien flitsen:
 * 1. een inline script dat bij de eerste (harde) paginalading vóór de rest
 *    van de inhoud draait en direct `location.replace` doet;
 * 2. een effect voor client-side navigatie (inline scripts draaien dan niet).
 *
 * De sleutel moet gelijk blijven aan TOKEN_KEY in src/lib/client/session.ts.
 */
const TOKEN_KEY = "padel_ladder_session_token";
const INLINE = `try{if(localStorage.getItem(${JSON.stringify(TOKEN_KEY)}))location.replace("/dashboard")}catch(e){}`;

export function RedirectIfSignedIn() {
  const router = useRouter();

  useEffect(() => {
    if (getStoredToken()) router.replace("/dashboard");
  }, [router]);

  return <script dangerouslySetInnerHTML={{ __html: INLINE }} />;
}
