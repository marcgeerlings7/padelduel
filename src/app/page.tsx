import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, Gauge, Layers, Scale, TimerReset, Users } from "lucide-react";
import { Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { EloDemo } from "@/components/public/EloDemo";
import { LiveLadderPreview } from "@/components/public/LiveLadderPreview";
import { RedirectIfSignedIn } from "@/components/public/RedirectIfSignedIn";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Vorm een duo",
    body: "Nodig je vaste partner uit, kies een regio en een duo-naam. Speel je met meerdere partners? Elk duo krijgt een eigen rating en plek.",
  },
  {
    title: "Daag uit in je tier",
    body: "Kies op de ladder een duo uit dezelfde regio en tier. Dat duo accepteert of weigert binnen de reactietermijn.",
  },
  {
    title: "Speel en geef de uitslag door",
    body: "Speel binnen de speeltermijn. Eén duo vult de sets in, het andere bevestigt de uitslag.",
  },
  {
    title: "Zie je rating bewegen",
    body: "Na bevestiging past de ELO-rating van beide duo's zich aan. Je positie en tier schuiven vanzelf mee.",
  },
];

const RULES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Layers,
    title: "Tiers houden het spannend",
    body: "De ladder is verdeeld in tiers van een vast aantal ratingpunten. Je daagt alleen duo's uit je eigen tier uit, dus elke wedstrijd is er een tegen je eigen niveau.",
  },
  {
    icon: TimerReset,
    title: "Geaccepteerd is afgesproken",
    body: "Wie een uitdaging laat verlopen of een geaccepteerde wedstrijd niet speelt, krijgt een vaste puntenstraf. Die staat los van de ELO-rating en is in de historie apart gemarkeerd.",
  },
  {
    icon: Scale,
    title: "Geschillen met een uitweg",
    body: "Klopt een uitslag niet, open dan een geschil. Een beheerder beslist. Wordt de score ongeldig verklaard, dan spelen jullie opnieuw met een nieuwe speeltermijn.",
  },
  {
    icon: Gauge,
    title: "Statistieken die iets zeggen",
    body: "Per duo zie je winst en verlies, de huidige reeks, set- en gamesaldo en welk deel van de uitdagingen echt gespeeld is. Duo's die lang niets doen, krijgen het label inactief.",
  },
  {
    icon: Users,
    title: "Meerdere partners, gescheiden ratings",
    body: "Speel met verschillende vaste partners in meerdere duo's tegelijk. Ratings en uitslagen van die duo's worden nooit gemengd.",
  },
  {
    icon: CalendarClock,
    title: "Beschikbaarheid delen",
    body: "Geef aan wanneer jullie kunnen spelen, met vaste dagdelen of eigen tijden, eenmalig of elke week. Zo vind je na een uitdaging snel een moment.",
  },
];

export default function Home() {
  return (
    <Page width="wide" className="gap-12 sm:gap-16">
      <RedirectIfSignedIn />

      {/* Hero: het court-vlak van deze pagina, met de echte ladder erin. */}
      <section
        aria-labelledby="hero-title"
        className="court-lines relative -mx-1 grid gap-8 overflow-hidden rounded-2xl bg-court px-5 pt-8 pb-5 text-court-foreground shadow-raised sm:mx-0 sm:px-8 sm:pt-12 sm:pb-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12 lg:py-14"
      >
        <div className="flex flex-col gap-5">
          <h1
            id="hero-title"
            className="font-display text-[3.25rem] leading-[0.88] font-bold tracking-tight italic sm:text-7xl lg:text-[5.25rem]"
          >
            Speel je plek op de ladder.
          </h1>
          <p className="max-w-[46ch] text-base text-court-muted sm:text-lg">
            Een ranked ladder voor padel-duo&apos;s, los van je vereniging. Daag duo&apos;s van jouw niveau uit,
            speel de wedstrijd en zie na elke bevestigde uitslag je rating bewegen.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="ball" size="lg" className="no-underline">
              <Link href="/register">Account aanmaken</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border border-white/30 text-court-foreground no-underline hover:bg-white/10 hover:text-court-foreground"
            >
              <Link href="/login">Inloggen</Link>
            </Button>
          </div>
        </div>
        <LiveLadderPreview />
      </section>

      {/* Stappen: een echte volgorde, dus genummerd. */}
      <section aria-labelledby="stappen-title" className="flex flex-col gap-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="stappen-title" className="font-display text-[2rem] leading-none font-bold sm:text-[2.5rem]">
            Van uitnodiging tot uitslag
          </h2>
          <p className="text-muted-foreground">
            Vier stappen tussen je eerste login en een hogere plek op de ladder.
          </p>
        </div>
        <ol className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0 sm:pb-8 lg:flex-col lg:gap-3 lg:pb-0">
              {/* verbindingslijn (mobiel verticaal) */}
              {index < STEPS.length - 1 ? (
                <span aria-hidden className="absolute top-11 bottom-0 left-[1.1rem] w-px bg-border sm:hidden" />
              ) : null}
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-score text-xl text-primary"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1 lg:border-t lg:pt-4">
                <h3 className="font-display text-xl leading-tight font-bold">{step.title}</h3>
                <p className="text-[0.9375rem] text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Rekenvoorbeeld met de echte ratingformule. */}
      <section aria-labelledby="elo-title" className="flex flex-col gap-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="elo-title" className="font-display text-[2rem] leading-none font-bold sm:text-[2.5rem]">
            Wat een uitslag waard is
          </h2>
          <p className="text-muted-foreground">
            De rating is een ELO-rating: winnen van een sterker duo levert meer op dan winnen van een zwakker duo.
            Daarnaast telt het gamesaldo mee: een 6-0 6-0 zegt meer dan een zege in de match-tiebreak. Probeer het.
          </p>
        </div>
        <EloDemo />
      </section>

      {/* Spelregels: geen reeks, dus geen nummers. */}
      <section aria-labelledby="regels-title" className="flex flex-col gap-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="regels-title" className="font-display text-[2rem] leading-none font-bold sm:text-[2.5rem]">
            Regels die iedereen scherp houden
          </h2>
          <p className="text-muted-foreground">
            Alle termijnen en straffen staan centraal ingesteld en zijn na te lezen in de{" "}
            <Link href="/info" className="font-semibold text-primary underline-offset-4 hover:underline">
              uitleg
            </Link>
            .
          </p>
        </div>
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 border-t py-5">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg leading-tight font-bold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Slot-CTA */}
      <section
        aria-labelledby="cta-title"
        className="flex flex-col items-start gap-5 rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="cta-title" className="font-display text-[1.75rem] leading-none font-bold sm:text-[2rem]">
            Klaar voor je eerste uitdaging?
          </h2>
          <p className="text-muted-foreground">
            Maak een account aan en nodig je partner uit. Zodra die accepteert, staan jullie op de ladder.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="no-underline">
            <Link href="/register">Account aanmaken</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="no-underline">
            <Link href="/info">Lees de spelregels</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
