import type { Transition, Variants } from "motion/react";

/**
 * Motion-tokens voor de hele app. Gebruik deze i.p.v. losse getallen, zodat
 * alles even snel en met dezelfde "snap" beweegt. Zie docs/Design_System.md §6.
 *
 * Vuistregels: UI-feedback ≤ 200ms, entree van content ≤ 250ms, nooit
 * animaties > 400ms behalve data-onthulling (charts, ringen).
 */
export const EASE_SNAP = [0.22, 1, 0.36, 1] as const;

export const duration = {
  instant: 0.1,
  fast: 0.16,
  base: 0.22,
  slow: 0.34,
} as const;

export const transition = {
  /** Standaard voor kleine UI-veranderingen. */
  fast: { duration: duration.fast, ease: EASE_SNAP },
  base: { duration: duration.base, ease: EASE_SNAP },
  /** Voor schuivende indicatoren (tabs, actieve pill) en layout-wissels. */
  spring: { type: "spring", stiffness: 520, damping: 42, mass: 0.7 },
} satisfies Record<string, Transition>;

/** Eén item dat binnenkomt: fade + 8px omhoog. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.base },
};

/**
 * Container voor een lijst die gestaggerd binnenkomt. Max ~8 items staggeren;
 * bij langere lijsten (ladder) alleen de container laten faden.
 */
export const staggerList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};
