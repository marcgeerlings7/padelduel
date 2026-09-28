import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combineert classNames (conditioneel via clsx) en lost conflicterende
 * Tailwind-utilities op (via tailwind-merge): `cn("px-2", isWide && "px-6")`.
 * Standaard-helper van shadcn/ui; gebruikt door alle componenten in
 * src/components/ui en src/components/app.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
