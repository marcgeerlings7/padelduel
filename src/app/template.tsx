"use client";

import { m } from "motion/react";
import { useEffect } from "react";

// Alleen client-side gezet (in useEffect), dus nooit gedeeld tussen
// server-requests. Eerste paint (SSR/hard refresh) animeert niet: content is
// meteen zichtbaar (geen opacity:0 in de server-HTML → geen LCP-vertraging).
let hasNavigated = false;

/**
 * Next.js template: wordt bij elke navigatie opnieuw gemount → één subtiele,
 * snelle entree per pagina (fade + 6px omhoog, ~180ms). Bij
 * prefers-reduced-motion valt de verschuiving weg (MotionConfig
 * reducedMotion="user" in Providers) en blijft alleen de fade.
 * Geen exit-animatie: die zou navigatie vertragen.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const animateIn = hasNavigated;
  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <m.div
      initial={animateIn ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
