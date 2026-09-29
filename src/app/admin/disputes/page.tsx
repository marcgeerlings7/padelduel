"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminNav } from "@/components/admin/AdminNav";
import { NativeSelect } from "@/components/availability/NativeSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Duo = { id: string; name: string };
type Dispute = {
  id: string;
  subject: "MATCH_SCORE" | "FORFEIT";
  reason: string;
  createdAt: string;
  raisedByUser: { email: string; displayName?: string | null };
  match: { id: string; scoreRaw: string; challenge: { challengerDuo: Duo; challengedDuo: Duo } } | null;
  challenge: { id: string; challengerDuo: Duo; challengedDuo: Duo } | null;
};

const dateFormat = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ActionOption({
  title,
  consequence,
  children,
}: {
  title: string;
  consequence: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background/60 p-3 sm:p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{consequence}</p>
      </div>
      {children}
    </div>
  );
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [atFaultChoice, setAtFaultChoice] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    apiFetch<Dispute[]>("/api/admin/disputes")
      .then(setDisputes)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de disputes niet laden. Vernieuw de pagina om het opnieuw te proberen.");
      });
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
  }, [router, reload]);

  async function resolve(disputeId: string, path: string, body: object, success: string) {
    setBusyId(disputeId);
    setActionError(null);
    try {
      await apiFetch(`/api/admin/disputes/${disputeId}/${path}`, { method: "POST", body: JSON.stringify(body) });
      toast.success(success);
      reload();
    } catch (err) {
      setActionError({
        id: disputeId,
        message: err instanceof ApiError ? err.message : "Afhandelen is mislukt. Probeer het opnieuw.",
      });
    } finally {
      setBusyId(null);
    }
  }

  function resolveMatchScore(disputeId: string, resolution: "upheld" | "overturned") {
    return resolve(
      disputeId,
      "resolve-match-score",
      { resolution },
      resolution === "upheld" ? "Score gehandhaafd" : "Match ongeldig verklaard",
    );
  }

  function resolveForfeit(disputeId: string, resolution: "upheld" | "overturned") {
    return resolve(
      disputeId,
      "resolve-forfeit",
      { resolution, atFaultDuoId: resolution === "overturned" ? atFaultChoice[disputeId] : undefined },
      resolution === "upheld" ? "Penalty bij beide gehandhaafd" : "Penalty eenzijdig toegewezen",
    );
  }

  const count = disputes?.length ?? 0;

  return (
    <Page>
      <AdminNav />
      <PageHeader
        title="Disputes"
        description="Betwiste uitslagen en forfeits. Je beslissing is definitief en werkt direct door in de ratings."
        meta={
          disputes ? (
            <Badge variant={count > 0 ? "warning" : "muted"}>
              {count === 1 ? "1 open dispute" : `${count} open disputes`}
            </Badge>
          ) : null
        }
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {!disputes && !error ? <ListSkeleton rows={3} label="Disputes laden" /> : null}

      {disputes && disputes.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Geen openstaande disputes"
          description="Alles is afgehandeld. Nieuwe disputes verschijnen hier zodra een duo een uitslag of forfeit betwist."
        />
      ) : null}

      {disputes && disputes.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {disputes.map((d) => {
            const duos = d.match?.challenge.challengerDuo
              ? [d.match.challenge.challengerDuo, d.match.challenge.challengedDuo]
              : d.challenge
                ? [d.challenge.challengerDuo, d.challenge.challengedDuo]
                : [];
            const busy = busyId === d.id;
            const selectId = `at-fault-${d.id}`;

            return (
              <li
                key={d.id}
                aria-busy={busy || undefined}
                className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-card sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="warning">{d.subject === "MATCH_SCORE" ? "Score-dispute" : "Forfeit-dispute"}</Badge>
                  <time dateTime={d.createdAt} className="text-xs text-muted-foreground">
                    Geopend {dateFormat.format(new Date(d.createdAt))}
                  </time>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {duos.map((duo) => (
                      <DuoAvatar key={duo.id} name={duo.name} size="md" className="ring-2 ring-card" />
                    ))}
                  </div>
                  <h2 className="min-w-0 font-display text-xl leading-tight font-bold text-balance">
                    {duos[0]?.name} vs. {duos[1]?.name}
                  </h2>
                </div>

                {d.match ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ingediende score</span>
                    <span className="flex flex-wrap gap-1.5">
                      {d.match.scoreRaw.split(",").map((set, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-muted px-2 py-0.5 font-score text-lg leading-tight tabular"
                        >
                          {set.trim()}
                        </span>
                      ))}
                    </span>
                  </div>
                ) : null}

                <figure className="flex flex-col gap-1 border-l-2 border-warning/60 pl-3">
                  <blockquote className="text-[0.9375rem] leading-relaxed">{d.reason}</blockquote>
                  <figcaption className="text-xs break-all text-muted-foreground">
                    Aangevraagd door{" "}
                    {d.raisedByUser.displayName
                      ? `${d.raisedByUser.displayName} (${d.raisedByUser.email})`
                      : d.raisedByUser.email}
                  </figcaption>
                </figure>

                {actionError?.id === d.id ? <AdminAlert>{actionError.message}</AdminAlert> : null}

                {d.subject === "MATCH_SCORE" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ActionOption
                      title="Uitslag klopt"
                      consequence="De score wordt definitief en de ratings worden verwerkt."
                    >
                      <Button type="button" disabled={busy} onClick={() => resolveMatchScore(d.id, "upheld")}>
                        {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
                        Score handhaven
                      </Button>
                    </ActionOption>
                    <ActionOption
                      title="Uitslag klopt niet"
                      consequence="De match vervalt; de duo's kunnen opnieuw een score indienen."
                    >
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => resolveMatchScore(d.id, "overturned")}
                      >
                        Match ongeldig verklaren
                      </Button>
                    </ActionOption>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ActionOption
                      title="Beide duo's in gebreke"
                      consequence="De vaste forfeit-penalty blijft bij beide duo's staan."
                    >
                      <Button type="button" disabled={busy} onClick={() => resolveForfeit(d.id, "upheld")}>
                        {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
                        Penalty bij beide handhaven
                      </Button>
                    </ActionOption>
                    <ActionOption
                      title="Eén duo in gebreke"
                      consequence="Alleen het gekozen duo houdt de penalty; de ander krijgt hem terug."
                    >
                      <div className="grid gap-2">
                        <Label htmlFor={selectId} className="sr-only">
                          In gebreke gebleven duo
                        </Label>
                        <NativeSelect
                          id={selectId}
                          value={atFaultChoice[d.id] ?? ""}
                          onChange={(e) => setAtFaultChoice((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        >
                          <option value="">Kies het duo in gebreke</option>
                          {duos.map((duo) => (
                            <option key={duo.id} value={duo.id}>
                              {duo.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || !atFaultChoice[d.id]}
                          onClick={() => resolveForfeit(d.id, "overturned")}
                        >
                          Eenzijdig toewijzen
                        </Button>
                      </div>
                    </ActionOption>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Page>
  );
}
