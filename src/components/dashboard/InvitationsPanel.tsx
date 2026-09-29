import { Inbox, Send } from "lucide-react";
import Link from "next/link";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { SectionCard } from "@/components/app/SectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { InvitationsData } from "./types";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

/**
 * Openstaande uitnodigingen op het dashboard: ontvangen (wacht op jou) en
 * verstuurd (wacht op de ander). Reageren gebeurt op /duos/invitations.
 */
export function InvitationsPanel({
  data,
  regionNames,
}: {
  /** null = laden, "error" = mislukt. */
  data: InvitationsData | null | "error";
  regionNames: ReadonlyMap<string, string>;
}) {
  const received = data && data !== "error" ? data.received : [];
  const sent = data && data !== "error" ? data.sent : [];

  return (
    <SectionCard
      id="uitnodigingen"
      title="Openstaande uitnodigingen"
      description={
        received.length > 0
          ? `${received.length} ${received.length === 1 ? "uitnodiging wacht" : "uitnodigingen wachten"} op jouw reactie.`
          : "Duo-voorstellen die nog op een reactie wachten."
      }
      action={
        received.length > 0 ? (
          <Badge variant="warning" className="font-score text-sm">
            {received.length}
          </Badge>
        ) : undefined
      }
    >
      {data === null ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Uitnodigingen laden…</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : data === "error" ? (
        <p role="alert" className="text-sm text-loss">
          Kon je uitnodigingen niet laden. Open{" "}
          <Link href="/duos/invitations" className="font-semibold underline underline-offset-4">
            je uitnodigingen
          </Link>{" "}
          om het opnieuw te proberen.
        </p>
      ) : received.length === 0 && sent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen openstaande uitnodigingen.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {received.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <DuoAvatar name={inv.duoName} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{inv.duoName}</span>
                <span className="text-xs text-muted-foreground">
                  {regionNames.get(inv.regionId) ?? "Regio onbekend"}, ontvangen{" "}
                  {dateFormatter.format(new Date(inv.createdAt))}
                </span>
              </div>
              <Badge variant="warning">
                <Inbox aria-hidden />
                Wacht op jou
              </Badge>
            </li>
          ))}
          {sent.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <DuoAvatar name={inv.duoName} size="sm" className="opacity-70" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{inv.duoName}</span>
                <span className="text-xs text-muted-foreground">
                  {regionNames.get(inv.regionId) ?? "Regio onbekend"}, verstuurd{" "}
                  {dateFormatter.format(new Date(inv.createdAt))}
                </span>
              </div>
              <Badge variant="muted">
                <Send aria-hidden />
                Verstuurd
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t pt-3">
        <Link
          href="/duos/invitations"
          className="rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Mijn uitnodigingen bekijken
        </Link>
      </div>
    </SectionCard>
  );
}
