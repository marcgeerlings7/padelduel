"use client";

import { BadgeCheck, Calculator, CircleCheck, ShieldX, UserCheck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminNav } from "@/components/admin/AdminNav";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { Button } from "@/components/ui/button";
import {
  useAdminStartRatings,
  type AdminStartRatingRegion,
  type AdminVerificationRequest,
} from "@/lib/client/useAdminStartRatings";

type Pending =
  | { kind: "verify"; request: AdminVerificationRequest; decision: "approve" | "reject" }
  | { kind: "recalculate"; region: AdminStartRatingRegion };

const dateFormat = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export default function AdminStartRatingsPage() {
  const { overview, loadError, actionError, busyKey, lastResult, decide, recalculate } = useAdminStartRatings();
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function ask(next: Pending) {
    setPending(next);
    setConfirmOpen(true);
  }

  return (
    <Page width="wide">
      <AdminNav />
      <PageHeader
        title="Startratings"
        description="Verifieer opgegeven KNLTB-speelsterktes en zet nieuwe duo's vóór een lancering op hun startrating. Alleen duo's die nog niets gespeeld of uitgedaagd hebben worden aangepast."
      />

      {loadError ? <AdminAlert>{loadError}</AdminAlert> : null}
      {actionError ? <AdminAlert>{actionError}</AdminAlert> : null}

      {lastResult ? (
        <div role="status" className="rounded-lg border border-win/30 bg-win-soft px-4 py-3 text-sm text-win">
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            {lastResult.label}:{" "}
            {lastResult.result.changed.length === 0
              ? "geen startratings gewijzigd"
              : `${lastResult.result.changed.length} ${lastResult.result.changed.length === 1 ? "startrating" : "startratings"} bijgewerkt`}
          </p>
          {lastResult.result.changed.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-0.5 pl-6 text-foreground">
              {lastResult.result.changed.map((c) => (
                <li key={c.duoId}>
                  {c.duoName}: <span className="tabular">{c.from}</span> → <span className="tabular font-semibold">{c.to}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!overview && !loadError ? <TableSkeleton rows={4} label="Startratings laden" /> : null}

      {overview ? (
        <>
          <SectionCard
            title="Verificatie-aanvragen"
            description="Vraag de speler per e-mail om een schermafbeelding van de speelsterkte in MijnKNLTB. Bewaar die niet; keur alleen goed als de opgegeven speelsterkte klopt."
            flush={overview.requests.length > 0}
            className="overflow-hidden"
          >
            {overview.requests.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Geen openstaande aanvragen"
                description="Spelers vragen verificatie aan via hun profiel."
              />
            ) : (
              <ul>
                {overview.requests.map((r) => {
                  const busy = busyKey === r.userId;
                  return (
                    <li
                      key={r.userId}
                      data-verification-email={r.email}
                      className="flex flex-col gap-3 border-t px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold break-words">{r.displayName ?? r.email}</span>
                        {r.displayName ? <span className="text-sm break-all text-muted-foreground">{r.email}</span> : null}
                        <span className="text-sm text-muted-foreground">
                          Speelsterkte <strong className="text-foreground">{r.knltbLevel}</strong> · startbonus{" "}
                          <span className="tabular">+{r.bonusNow}</span> →{" "}
                          <span className="tabular font-semibold text-foreground">+{r.bonusIfVerified}</span> · aangevraagd{" "}
                          {dateFormat.format(new Date(r.requestedAt))}
                        </span>
                      </div>
                      <div className="flex gap-2 max-sm:w-full">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => ask({ kind: "verify", request: r, decision: "reject" })}
                          className="text-destructive hover:text-destructive max-sm:flex-1"
                        >
                          <ShieldX aria-hidden />
                          Afwijzen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => ask({ kind: "verify", request: r, decision: "approve" })}
                          className="max-sm:flex-1"
                        >
                          <BadgeCheck aria-hidden />
                          Verifiëren
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Startratings herberekenen"
            description="Gebruik dit vlak vóór een regio-lancering: nog niet gespeelde duo's krijgen de startrating die bij de huidige speelsterktes hoort, zodat de tiers vanaf dag één gespreid zijn."
            flush
            className="overflow-hidden"
          >
            <ul>
              {overview.regions.map((region) => (
                <li
                  key={region.id}
                  className="flex items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{region.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {region.unplayedDuoCount === 1 ? "1 duo" : `${region.unplayedDuoCount} duo's`} zonder gespeelde
                      wedstrijd
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    disabled={busyKey === region.id}
                    onClick={() => ask({ kind: "recalculate", region })}
                  >
                    <Calculator aria-hidden />
                    Herberekenen
                    <span className="sr-only"> voor {region.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      ) : null}

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          pending?.kind === "recalculate"
            ? `Startratings herberekenen voor ${pending.region.name}?`
            : pending?.decision === "approve"
              ? "Speelsterkte verifiëren?"
              : "Aanvraag afwijzen?"
        }
        description={
          pending?.kind === "recalculate"
            ? "Alleen actieve duo's zonder wedstrijden, rating-historie of uitdagingen worden aangepast. Dit wordt gelogd."
            : pending?.decision === "approve"
              ? "Controleer eerst de schermafbeelding uit MijnKNLTB. De nog niet gespeelde duo's van deze speler krijgen daarna direct de hogere startbonus."
              : "De speler houdt de speelsterkte, maar zonder verificatie. Hij of zij kan opnieuw aanvragen."
        }
        confirmLabel={
          pending?.kind === "recalculate" ? "Ja, herberekenen" : pending?.decision === "approve" ? "Ja, verifiëren" : "Ja, afwijzen"
        }
        tone={pending?.kind === "verify" && pending.decision === "reject" ? "destructive" : "default"}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === "recalculate") void recalculate(pending.region);
          else void decide(pending.request, pending.decision);
        }}
      />
    </Page>
  );
}
