"use client";

import { Check, Inbox, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invitationMeta } from "@/components/dashboard/invitation-meta";
import type { InvitationsData } from "@/components/dashboard/types";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

export default function InvitationsPage() {
  const router = useRouter();
  const [data, setData] = useState<InvitationsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return apiFetch<InvitationsData>("/api/duos/invitations")
      .then((result) => {
        setData(result);
        setLoadError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setLoadError("Kon je uitnodigingen niet laden. Ververs de pagina om het opnieuw te proberen.");
      });
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
  }, [router, reload]);

  async function respond(id: string, decision: "accept" | "decline") {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/duos/invitations/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      // Bewust zonder duonaam: toasts zijn <li>'s, en e2e telt `li` met de duonaam.
      toast.success(decision === "accept" ? "Uitnodiging geaccepteerd" : "Uitnodiging geweigerd", {
        description: decision === "accept" ? "Jullie duo staat nu op de ladder." : undefined,
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Reageren is mislukt. Probeer het opnieuw.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Mijn uitnodigingen"
        description="Duo-voorstellen die nog op een reactie wachten."
        back={{ href: "/dashboard", label: "Mijn duo's" }}
      />

      {loadError ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {loadError}
        </div>
      ) : null}

      {actionError ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {actionError}
        </div>
      ) : null}

      {!data && !loadError ? (
        <ListSkeleton rows={3} label="Uitnodigingen laden…" />
      ) : data ? (
        <>
          <SectionCard
            id="ontvangen"
            title="Ontvangen"
            description="Wacht op jouw reactie."
            flush
            action={
              data.received.length > 0 ? (
                <Badge variant="warning" className="font-score text-sm">
                  {data.received.length}
                </Badge>
              ) : undefined
            }
          >
            {data.received.length === 0 ? (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Geen openstaande uitnodigingen"
                  description="Als iemand een duo met je voorstelt, kun je dat hier accepteren of weigeren."
                />
              </div>
            ) : (
              <ul className="flex flex-col">
                {data.received.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-3 border-t px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <DuoAvatar name={inv.duoName} size="md" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{inv.duoName}</span>
                        <span className="text-xs text-muted-foreground">
                          {invitationMeta(inv, "received")}. Ontvangen op {dateFormatter.format(new Date(inv.createdAt))}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <Button
                        type="button"
                        disabled={busyId !== null}
                        aria-busy={busyId === inv.id || undefined}
                        onClick={() => respond(inv.id, "accept")}
                      >
                        <Check aria-hidden />
                        Accepteren
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId !== null}
                        onClick={() => respond(inv.id, "decline")}
                      >
                        <X aria-hidden />
                        Weigeren
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard id="verstuurd" title="Verstuurd" description="Wacht op de reactie van je partner." flush>
            {data.sent.length === 0 ? (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <EmptyState
                  compact
                  icon={Send}
                  title="Geen openstaande voorstellen"
                  description="Stel een duo voor en nodig je partner uit via e-mail."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/duos/propose">Duo voorstellen</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="flex flex-col">
                {data.sent.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 border-t px-4 py-3.5 sm:px-5">
                    <DuoAvatar name={inv.duoName} size="md" className="opacity-70" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{inv.duoName}</span>
                      <span className="text-xs text-muted-foreground">
                        {invitationMeta(inv, "sent")}. Verstuurd op {dateFormatter.format(new Date(inv.createdAt))}
                      </span>
                    </div>
                    <Badge variant="muted">In afwachting</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}
    </Page>
  );
}
