"use client";

import { CalendarClock, Swords, Trophy } from "lucide-react";
import { m } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { CardSkeleton, ListSkeleton, StatGridSkeleton } from "@/components/app/LoadingSkeletons";
import { fadeUp, staggerList } from "@/components/app/motion";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { RankBadge } from "@/components/app/RankBadge";
import { RatingChart, RatingSparkline } from "@/components/app/RatingChart";
import { RatingDelta } from "@/components/app/RatingDelta";
import { toRatingSeries } from "@/components/app/rating-series";
import { SectionCard } from "@/components/app/SectionCard";
import { StatCard } from "@/components/app/StatCard";
import { TierBadge } from "@/components/app/TierBadge";
import ActivityRings from "@/components/kokonutui/apple-activity-card";
import HoldButton from "@/components/kokonutui/hold-button";
import SmoothDrawer from "@/components/kokonutui/smooth-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LADDER = [
  { name: "Smash Sisters", rating: 1395, delta: 14, tier: 3, own: true },
  { name: "Bandeja Brothers", rating: 1342, delta: -9, tier: 3, own: false },
  { name: "Vibora Club", rating: 1318, delta: 0, tier: 3, own: false },
  { name: "Chiquita Chargers", rating: 1251, delta: 22, tier: 2, own: true },
  { name: "Global Gladiators", rating: 1020, delta: -25, tier: 1, own: false, forfeit: true },
];

// Deterministische voorbeelddata (geen Math.random → geen hydration-verschil).
const HISTORY = [0, 16, -12, 21, 9, -18, 24, 14, -7, 19, 12].reduce<
  { createdAt: string; ratingBefore: number; ratingAfter: number }[]
>((acc, delta, i) => {
  const before = acc.length ? acc[acc.length - 1].ratingAfter : 1200;
  acc.push({ createdAt: new Date(Date.UTC(2026, 6, 1 + i * 6)).toISOString(), ratingBefore: before, ratingAfter: before + delta });
  return acc;
}, []);

export function DesignShowcase() {
  const series = useMemo(() => toRatingSeries(HISTORY), []);
  const [rating, setRating] = useState(1395);

  return (
    <Page width="wide">
      <PageHeader
        title="Court design system"
        description="Levende referentie voor pagina-redesigns. Zie docs/Design_System.md."
        meta={
          <>
            <Badge variant="soft">Regio Utrecht</Badge>
            <TierBadge tier={3} />
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setRating((r) => r - 12)}>
              −12
            </Button>
            <Button onClick={() => setRating((r) => r + 16)}>+16 rating</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          emphasis
          label="Rating"
          icon={Trophy}
          value={<AnimatedNumber value={rating} />}
          delta={<RatingDelta value={rating - 1395} variant="inline" tone="court" />}
          hint="Smash Sisters"
        />
        <StatCard label="Positie" value={<AnimatedNumber value={1} />} hint="van 10 in Utrecht" />
        <StatCard label="Gewonnen" value="8–3" hint="laatste 11 wedstrijden" />
        <StatCard label="Trend" value="+84" trailing={<RatingSparkline data={series} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard title="Ladder" description="Utrecht · tier-grootte 100" flush>
          <m.ol variants={staggerList} initial="hidden" animate="visible" className="flex flex-col">
            {LADDER.map((duo, i) => (
              <m.li
                key={duo.name}
                variants={fadeUp}
                data-own={duo.own || undefined}
                className="flex items-center gap-3 border-t px-4 py-3 data-own:bg-primary-soft/60 sm:px-5"
              >
                <RankBadge position={i + 1} size="sm" />
                <DuoAvatar name={duo.name} size="sm" own={duo.own} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{duo.name}</span>
                  <span className="text-xs text-muted-foreground">Tier {duo.tier}</span>
                </div>
                <RatingDelta value={duo.delta} forfeit={duo.forfeit} />
                <span className="w-12 text-right font-score text-xl">{duo.rating}</span>
              </m.li>
            ))}
          </m.ol>
        </SectionCard>

        <SectionCard title="Ratingverloop" description="Stippellijnen: tier-grenzen">
          <RatingChart data={series} tierSize={100} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Knoppen">
          <div className="flex flex-wrap gap-2">
            <Button>Uitdagen</Button>
            <Button variant="ball">Uitslag invoeren</Button>
            <Button variant="soft">Details</Button>
            <Button variant="outline">Annuleren</Button>
            <Button variant="ghost">Overslaan</Button>
            <Button variant="destructive">Weigeren</Button>
            <Button variant="link">Uitleg</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <HoldButton onConfirm={() => toast.success("Duo opgeheven")}>Houd vast om op te heffen</HoldButton>
            <SmoothDrawer
              trigger={<Button variant="outline">Open drawer</Button>}
              title="Bandeja Brothers uitdagen?"
              description="Ze hebben 72 uur om te reageren. Daarna vervalt de uitdaging."
              footer={
                <Button size="lg" onClick={() => toast.success("Uitdaging verstuurd")}>
                  Verstuur uitdaging
                </Button>
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Badges & status">
          <div className="flex flex-wrap gap-2">
            <Badge>Actief</Badge>
            <Badge variant="soft">Uitgedaagd</Badge>
            <Badge variant="win">Gewonnen</Badge>
            <Badge variant="loss">Verloren</Badge>
            <Badge variant="warning">Betwist</Badge>
            <Badge variant="muted">Verlopen</Badge>
            <Badge variant="ball">#1</Badge>
            <Badge variant="outline">Tier 2</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <RatingDelta value={18} size="md" />
            <RatingDelta value={-11} size="md" />
            <RatingDelta value={0} size="md" />
            <RatingDelta value={-25} size="md" forfeit />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <RankBadge position={1} size="lg" />
            <RankBadge position={2} size="lg" />
            <RankBadge position={7} size="lg" />
          </div>
        </SectionCard>

        <SectionCard title="Formulier">
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid gap-2">
              <Label htmlFor="ds-name">Duonaam</Label>
              <Input id="ds-name" placeholder="Bijv. Smash Sisters" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-region">Regio</Label>
              <Select defaultValue="utrecht">
                <SelectTrigger id="ds-region" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utrecht">Utrecht</SelectItem>
                  <SelectItem value="amsterdam">Amsterdam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={() => toast("Opgeslagen")}>
              Opslaan
            </Button>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Speelverplichting">
          <ActivityRings
            rings={[
              { label: "Gespeeld deze maand", current: 2, target: 3, color: "var(--primary)" },
              { label: "Winstpercentage", current: 64, target: 100, unit: "%", color: "var(--win)" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Tabs">
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="gespeeld">Gespeeld</TabsTrigger>
            </TabsList>
            <TabsContent value="open" className="pt-3">
              <EmptyState compact icon={Swords} title="Geen open challenges" description="Daag een duo uit binnen je tier-bereik." />
            </TabsContent>
            <TabsContent value="gespeeld" className="pt-3">
              <EmptyState compact icon={CalendarClock} title="Nog niets gespeeld" />
            </TabsContent>
          </Tabs>
        </SectionCard>
        <SectionCard title="Laden">
          <div className="flex flex-col gap-3">
            <StatGridSkeleton count={2} className="grid-cols-2 lg:grid-cols-2" />
            <CardSkeleton lines={2} />
            <ListSkeleton rows={2} />
          </div>
        </SectionCard>
      </div>

      <SectionCard variant="court" title="Jouw duo" description="Court-vlak: maximaal één per pagina.">
        <div className="flex items-center gap-4">
          <DuoAvatar name="Smash Sisters" size="lg" />
          <div className="flex flex-col gap-1">
            <span className="font-display text-2xl font-bold">Smash Sisters</span>
            <TierBadge tier={3} variant="court" />
          </div>
          <span className="ml-auto font-score text-5xl text-ball">1395</span>
        </div>
      </SectionCard>
    </Page>
  );
}
