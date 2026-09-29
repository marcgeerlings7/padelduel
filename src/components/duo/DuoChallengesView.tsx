"use client";

import { Swords } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { transition } from "@/components/app/motion";
import { ChallengeCard, type ChallengeActions } from "@/components/matches/ChallengeCard";
import {
  type Challenge,
  type ChallengeGroup,
  GROUP_DESCRIPTIONS,
  GROUP_LABELS,
  GROUP_ORDER,
  groupChallenges,
} from "@/components/matches/challenges";
import { getStoredUserId } from "@/components/matches/useOwnDuos";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { cn } from "@/lib/utils";

type Filter = "all" | ChallengeGroup;

/**
 * Alle challenges van één duo, ingedeeld in inkomend / te spelen / uitslag /
 * uitgaand / afgerond, met een filterbalk (tabs) erboven. "Alles" (standaard)
 * toont alle groepen onder elkaar, zodat een kaart na een actie zichtbaar
 * naar de volgende groep verhuist.
 */
export function DuoChallengesView({ duoId, duoName }: { duoId: string; duoName?: string }) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    apiFetch<Challenge[]>(`/api/duos/${duoId}/challenges`)
      .then((data) => {
        if (request !== requestRef.current) return;
        setChallenges(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (request !== requestRef.current) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof ApiError && err.status === 403 ? err.message : "Kon de challenges niet laden.");
      });
  }, [duoId, router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    setMyUserId(getStoredUserId());
    setChallenges(null);
    setLoadError(null);
    setFilter("all");
    reload();
  }, [reload, router]);

  const groups = useMemo(() => (challenges ? groupChallenges(challenges, duoId) : null), [challenges, duoId]);

  const ownName = useMemo(() => {
    if (duoName) return duoName;
    const any = challenges?.[0];
    if (!any) return "Jullie";
    return any.challengerDuoId === duoId ? any.challengerDuo.name : any.challengedDuo.name;
  }, [challenges, duoId, duoName]);

  // Een filter waarvan de groep leeg raakt (kaart verhuisd na een actie) → terug naar "Alles".
  useEffect(() => {
    if (groups && filter !== "all" && groups[filter].length === 0) setFilter("all");
  }, [groups, filter]);

  const actions: ChallengeActions = useMemo(
    () => ({
      reload,
      respond: async (challengeId, decision) => {
        setBusyId(challengeId);
        setActionError(null);
        try {
          await apiFetch(`/api/challenges/${challengeId}/respond`, {
            method: "POST",
            body: JSON.stringify({ decision }),
          });
          toast.success(decision === "accept" ? "Uitdaging aangenomen" : "Uitdaging afgewezen");
          reload();
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : "Er is iets misgegaan. Probeer het opnieuw.");
        } finally {
          setBusyId(null);
        }
      },
      respondToMatch: async (matchId, decision) => {
        setBusyId(matchId);
        setActionError(null);
        try {
          await apiFetch(`/api/matches/${matchId}/respond`, {
            method: "POST",
            body: JSON.stringify({ decision }),
          });
          toast.success(decision === "confirm" ? "Uitslag goedgekeurd" : "Leg nu uit wat er niet klopt");
          reload();
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : "Er is iets misgegaan. Probeer het opnieuw.");
        } finally {
          setBusyId(null);
        }
      },
    }),
    [reload],
  );

  if (loadError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
        <p>{loadError}</p>
        <Button type="button" size="sm" variant="outline" onClick={reload}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  if (!challenges || !groups) {
    return <ListSkeleton rows={4} label="Challenges laden…" />;
  }

  if (challenges.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="Nog geen challenges"
        description="Daag een duo uit dat in dezelfde rank-tier staat. Dat doe je vanaf de ladder."
        action={
          <Button asChild>
            <Link href="/ladder">Naar de ladder</Link>
          </Button>
        }
      />
    );
  }

  const visibleGroups = GROUP_ORDER.filter((g) => groups[g].length > 0 && (filter === "all" || filter === g));
  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Alles", count: challenges.length },
    ...GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => ({
      value: g,
      label: GROUP_LABELS[g],
      count: groups[g].length,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <FilterTabs tabs={tabs} value={filter} onChange={setFilter} controls={`challenges-${duoId}`} />

      {actionError ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {actionError}
        </div>
      ) : null}

      <div id={`challenges-${duoId}`} role="tabpanel" aria-label={filter === "all" ? "Alle challenges" : GROUP_LABELS[filter]} className="flex flex-col gap-8">
        {visibleGroups.map((group) => (
          <section key={group} aria-labelledby={`group-${group}`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id={`group-${group}`} className="flex items-baseline gap-2 font-display text-[1.375rem] leading-tight font-bold">
                {GROUP_LABELS[group]}
                <span className="font-score text-lg text-muted-foreground">{groups[group].length}</span>
              </h2>
              <p className="text-sm text-muted-foreground">{GROUP_DESCRIPTIONS[group]}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {groups[group].map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  group={group}
                  duoId={duoId}
                  ownName={ownName}
                  myUserId={myUserId}
                  busyId={busyId}
                  actions={actions}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Filterbalk als tablist; horizontaal scrollbaar op mobiel, pijltjestoetsen wisselen. */
function FilterTabs({
  tabs,
  value,
  onChange,
  controls,
}: {
  tabs: { value: Filter; label: string; count: number }[];
  value: Filter;
  onChange: (value: Filter) => void;
  controls: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="Filter challenges" className="flex w-max gap-1 rounded-full border bg-card p-1 shadow-card">
        {tabs.map((tab, index) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={controls}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.value)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <m.span
                  layoutId="challenge-filter-pill"
                  transition={transition.spring}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary"
                />
              ) : null}
              <span className="relative">{tab.label}</span>
              <span
                className={cn(
                  "relative min-w-5 rounded-full px-1.5 text-center font-score text-sm leading-5 tabular",
                  active ? "bg-white/20" : "bg-muted",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
