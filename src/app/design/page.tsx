import { notFound } from "next/navigation";
import { DesignShowcase } from "./DesignShowcase";

export const metadata = { title: "Design system — Padel Ladder" };

/**
 * Levende catalogus van het Court-design system (docs/Design_System.md).
 * Alleen beschikbaar buiten productie — referentie voor pagina-redesigns.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
