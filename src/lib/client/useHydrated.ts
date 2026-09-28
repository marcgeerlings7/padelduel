"use client";

import { useEffect, useState } from "react";

/**
 * `true` zodra de component client-side gehydrateerd is. Gebruik dit om
 * submit-knoppen van formulieren met een `onSubmit`-handler uit te
 * schakelen tot React actief is: anders verstuurt de browser het
 * formulier bij een vroege klik (trage telefoon) als gewone GET en raakt
 * de gebruiker zijn invoer kwijt.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
