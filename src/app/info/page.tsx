import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { BulletList, Details, Formula, InfoSection, Num } from "@/components/public/InfoBlocks";
import { applyMatchResult, DEFAULT_K_FACTOR_CONFIG, DEFAULT_MARGIN_CONFIG, MARGIN_CONFIG_KEYS, expectedScore } from "@/lib/elo";
import { DEFAULT_INACTIVE_AFTER_DAYS, INACTIVE_AFTER_DAYS_KEY } from "@/lib/stats/activity";
import { summarizeScore } from "@/lib/match/score";
import { getConfigNumber, getConfigNumberOrDefault } from "@/server/repositories/platformConfigRepository";

export const metadata: Metadata = {
  title: "Uitleg · Padel Ladder",
  description:
    "Hoe de ladder, tiers, uitdagingen, uitstel, walkovers, de ELO-rating, statistieken, geschillen en e-mailmeldingen werken.",
};

// De getallen komen live uit platform_config (nooit hardcoded), dus per request renderen.
export const dynamic = "force-dynamic";

type InfoConfig = {
  tierSize: number;
  maxDuos: number;
  responseDays: number;
  matchDays: number;
  penalty: number;
  forfeitCooldownDays: number;
  dissolutionCooldownDays: number;
  autoConfirmHours: number;
  repeatWindowDays: number;
  forfeitDisputeDays: number;
  marginMin: number;
  marginMax: number;
  inactiveDays: number;
  startRating: number;
  postponementMaxDays: number;
  postponementMaxPerChallenge: number;
  reminderResponseHours: number;
  reminderMatchHours: number;
  reminderAutoConfirmHours: number;
};

async function loadConfig(): Promise<InfoConfig | null> {
  try {
    const [
      tierSize,
      maxDuos,
      responseDays,
      matchDays,
      penalty,
      forfeitCooldownDays,
      dissolutionCooldownDays,
      autoConfirmHours,
      repeatWindowDays,
      forfeitDisputeDays,
      marginMin,
      marginMax,
      inactiveDays,
      startRating,
      postponementMaxDays,
      postponementMaxPerChallenge,
      reminderResponseHours,
      reminderMatchHours,
      reminderAutoConfirmHours,
    ] = await Promise.all([
      getConfigNumber("rating_tier_size"),
      getConfigNumber("max_active_duos_per_user"),
      getConfigNumber("challenge_response_deadline_days"),
      getConfigNumber("challenge_match_deadline_days"),
      getConfigNumber("forfeit_rating_penalty"),
      getConfigNumber("forfeit_cooldown_days"),
      getConfigNumber("duo_dissolution_cooldown_days"),
      getConfigNumber("match_auto_confirm_hours"),
      getConfigNumber("repeated_opponent_window_days"),
      getConfigNumber("forfeit_dispute_window_days"),
      getConfigNumberOrDefault(MARGIN_CONFIG_KEYS.minMultiplier, DEFAULT_MARGIN_CONFIG.minMultiplier),
      getConfigNumberOrDefault(MARGIN_CONFIG_KEYS.maxMultiplier, DEFAULT_MARGIN_CONFIG.maxMultiplier),
      getConfigNumberOrDefault(INACTIVE_AFTER_DAYS_KEY, DEFAULT_INACTIVE_AFTER_DAYS),
      getConfigNumber("default_start_rating"),
      getConfigNumber("postponement_max_days"),
      getConfigNumber("postponement_max_per_challenge"),
      getConfigNumber("notification_response_deadline_lead_hours"),
      getConfigNumber("notification_match_deadline_lead_hours"),
      getConfigNumber("notification_auto_confirm_lead_hours"),
    ]);
    return {
      tierSize,
      maxDuos,
      responseDays,
      matchDays,
      penalty,
      forfeitCooldownDays,
      dissolutionCooldownDays,
      autoConfirmHours,
      repeatWindowDays,
      forfeitDisputeDays,
      marginMin,
      marginMax,
      inactiveDays,
      startRating,
      postponementMaxDays,
      postponementMaxPerChallenge,
      reminderResponseHours,
      reminderMatchHours,
      reminderAutoConfirmHours,
    };
  } catch (err) {
    console.error("Uitlegpagina: platform_config kon niet geladen worden", err);
    return null;
  }
}

const K = DEFAULT_K_FACTOR_CONFIG;
const RATING_CAP = 50;

function fmt(value: number, digits = 2): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: digits, useGrouping: false }).format(value);
}
const days = (n: number | null) => (n === 1 ? "dag" : "dagen");

const TOC = [
  { id: "ladder", label: "Ladder" },
  { id: "duos", label: "Duo's" },
  { id: "tiers", label: "Tiers" },
  { id: "uitdagen", label: "Uitdagen" },
  { id: "speelverplichting", label: "Speelverplichting" },
  { id: "uitstel", label: "Uitstel" },
  { id: "uitslag", label: "Uitslag" },
  { id: "rating", label: "ELO-rating" },
  { id: "statistieken", label: "Statistieken" },
  { id: "geschillen", label: "Geschillen" },
  { id: "beschikbaarheid", label: "Beschikbaarheid" },
  { id: "profiel", label: "Profiel en e-mail" },
  { id: "beheer", label: "Beheer" },
];

/** Uitgewerkt voorbeeld, doorgerekend met de échte functies en de actuele gamesaldo-instellingen. */
function workedExample(config: InfoConfig | null) {
  const a = { id: "A", currentRating: 1450, matchesPlayed: 20 };
  const b = { id: "B", currentRating: 1380, matchesPlayed: 20 };
  const summary = summarizeScore([
    { challengerGames: 6, challengedGames: 4 },
    { challengerGames: 6, challengedGames: 3 },
  ]);
  const marginConfig = config
    ? { minMultiplier: config.marginMin, maxMultiplier: config.marginMax }
    : DEFAULT_MARGIN_CONFIG;
  try {
    const outcome = applyMatchResult({
      winner: a,
      loser: b,
      winnerPercentile: 0.5,
      loserPercentile: 0.5,
      games: { winner: summary.challengerGames, loser: summary.challengedGames },
      marginConfig,
    });
    return {
      expected: expectedScore(a.currentRating, b.currentRating),
      games: `${summary.challengerGames}-${summary.challengedGames}`,
      margin: (summary.challengerGames - summary.challengedGames) / (summary.challengerGames + summary.challengedGames),
      multiplier: outcome.marginMultiplier,
      winnerDelta: outcome.winnerNewRating - a.currentRating,
      loserDelta: outcome.loserNewRating - b.currentRating,
      winnerNew: outcome.winnerNewRating,
      loserNew: outcome.loserNewRating,
    };
  } catch {
    return null;
  }
}

export default async function InfoPage() {
  const config = await loadConfig();
  const c = <T extends keyof InfoConfig>(key: T): number | null => (config ? config[key] : null);
  const example = workedExample(config);

  return (
    <Page>
      <PageHeader
        title="Hoe werkt Padel Ladder?"
        description="Van de ladder tot de precieze ratingberekening. Elk onderdeel begint met de kern; klap een blok open voor de details en exacte getallen."
      />

      {config === null ? (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          De actuele instellingen konden niet geladen worden, dus sommige getallen ontbreken (—). Probeer het later
          opnieuw.
        </div>
      ) : null}

      {/* Kerngetallen: de instellingen waar je het vaakst mee te maken krijgt. */}
      <section aria-labelledby="kerngetallen-title" className="flex flex-col gap-3">
        <h2 id="kerngetallen-title" className="sr-only">
          Kerngetallen
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border shadow-card sm:grid-cols-3">
          <KeyFigure label="Startrating eerste duo" value={c("startRating")} />
          <KeyFigure label="Breedte van een tier" value={c("tierSize")} unit="punten" />
          <KeyFigure label="Reageren op een uitdaging" value={c("responseDays")} unit={days(c("responseDays"))} />
          <KeyFigure label="Spelen na acceptatie" value={c("matchDays")} unit={days(c("matchDays"))} />
          <KeyFigure label="Strafpunten bij forfeit" value={c("penalty")} unit="punten" />
          <KeyFigure label="Actieve duo's per speler" value={c("maxDuos")} unit="max." unitFirst />
        </dl>
      </section>

      <nav aria-label="Onderwerpen" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {TOC.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="inline-flex h-9 items-center rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap no-underline hover:bg-accent"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <InfoSection
        id="ladder"
        title="De ladder"
        lead={
          <>
            <p>
              Alle duo&apos;s in een regio staan op één ranglijst: hoe hoger de rating, hoe hoger de plek. Bij een
              gelijke rating staat het duo dat het langst meedoet bovenaan.
            </p>
            <p>
              Positie en tier worden nooit los opgeslagen: ze worden steeds opnieuw afgeleid uit de actuele rating.
              Verandert je rating, dan schuift je plek direct mee. De ladder is openbaar:{" "}
              <Link href="/ladder" className="font-semibold text-primary underline-offset-4 hover:underline">
                bekijk hem hier
              </Link>
              .
            </p>
          </>
        }
      />

      <InfoSection
        id="duos"
        title="Duo's"
        lead={
          <>
            <p>
              Je speelt altijd als duo. Je nodigt een partner uit met een voorstel (regio en duo-naam, en optioneel het
              speltype: heren, dames of gemengd); zodra die accepteert, staat het duo op de ladder.
            </p>
            <p>
              Met verschillende partners mag je in meerdere duo&apos;s tegelijk spelen, tot{" "}
              <Num value={c("maxDuos")} unit="actieve duo's" /> per speler. Elk duo heeft een eigen rating, plek en
              wedstrijdgeschiedenis.
            </p>
          </>
        }
      >
        <Details summary="Met welke rating begint een nieuw duo?">
          <p>
            De startrating is het gemiddelde van beide spelers. Voor elke speler telt het gemiddelde van de rating van
            zijn of haar andere actieve duo&apos;s. Speelt iemand nog in geen enkel ander duo, dan telt voor die
            speler de standaard startrating van <Num value={c("startRating")} />.
          </p>
          <BulletList>
            <li>
              Twee nieuwe spelers beginnen dus op <Num value={c("startRating")} />.
            </li>
            <li>
              Speelt de één al in een duo met rating 1400 en is de ander nieuw, dan begint het nieuwe duo op het
              gemiddelde van 1400 en <Num value={c("startRating")} />.
            </li>
            <li>De zelf opgegeven speelsterkte telt hier niet mee.</li>
          </BulletList>
        </Details>
        <Details summary="Ontbinden en opnieuw samen spelen">
          <BulletList>
            <li>Dezelfde twee spelers kunnen nooit twee actieve duo&apos;s tegelijk hebben.</li>
            <li>
              Een duo ontbinden vraagt bevestiging van beide spelers: de één vraagt het aan, de ander bevestigt.
            </li>
            <li>
              Na een ontbinding kunnen dezelfde twee spelers pas na{" "}
              <Num value={c("dissolutionCooldownDays")} unit={days(c("dissolutionCooldownDays"))} /> weer samen een duo
              vormen.
            </li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="tiers"
        title="Tiers"
        lead={
          <p>
            De ladder is verdeeld in <strong>tiers</strong>: stroken van <Num value={c("tierSize")} unit="ratingpunten" />
            . Je tier volgt automatisch uit je rating. Duo&apos;s in dezelfde tier zijn ongeveer even sterk, en alleen
            die mag je uitdagen.
          </p>
        }
      >
        <Details summary="Hoe wordt mijn tier berekend?">
          <p>Je tier is je rating gedeeld door de tier-breedte, naar beneden afgerond:</p>
          <Formula>tier = ⌊ rating ÷ {c("tierSize") ?? "tier-breedte"} ⌋</Formula>
          {c("tierSize") !== null ? (
            <BulletList>
              {[1450, 1099, 1100].map((rating) => (
                <li key={rating}>
                  rating <span className="tabular">{rating}</span> → tier{" "}
                  <strong className="tabular">{Math.floor(rating / (c("tierSize") as number))}</strong>
                </li>
              ))}
            </BulletList>
          ) : null}
          <p>Win je over een tiergrens heen, dan zit je vanaf dat moment in de nieuwe tier.</p>
        </Details>
      </InfoSection>

      <InfoSection
        id="uitdagen"
        title="Uitdagen"
        lead={
          <>
            <p>
              Vanaf de ladder daag je een duo uit dezelfde regio én dezelfde tier uit. Een duo heeft steeds maximaal
              één lopende uitdaging, als uitdager of als uitgedaagde.
            </p>
            <p>
              Het uitgedaagde duo heeft <Num value={c("responseDays")} unit={days(c("responseDays"))} /> om te
              accepteren of te weigeren. Weigeren kost niets.
            </p>
          </>
        }
      />

      <InfoSection
        id="speelverplichting"
        title="Speelverplichting en forfeits"
        lead={
          <>
            <p>
              Een geaccepteerde uitdaging is een afspraak: jullie spelen de wedstrijd binnen{" "}
              <Num value={c("matchDays")} unit={days(c("matchDays"))} />. Wie zich daar niet aan houdt, krijgt een
              forfeit: een vaste straf van <Num value={c("penalty")} unit="punten" />.
            </p>
            <p>
              Een forfeit is <strong>geen</strong> verloren wedstrijd en loopt niet via de ELO-formule. In je
              ratinghistorie staat hij apart gemarkeerd.
            </p>
          </>
        }
      >
        <Details summary="Wie krijgt wanneer een forfeit?">
          <BulletList>
            <li>
              <strong>Niet gereageerd</strong> binnen <Num value={c("responseDays")} unit={days(c("responseDays"))} />:
              alleen het uitgedaagde duo krijgt de straf.
            </li>
            <li>
              <strong>Niet gespeeld</strong> binnen <Num value={c("matchDays")} unit={days(c("matchDays"))} /> na
              acceptatie: beide duo&apos;s krijgen de straf, want allebei hadden ze de afspraak kunnen nakomen. Via een
              geschil kan een beheerder de schuld bij één duo leggen.
            </li>
            <li>
              Na een forfeit zit een duo{" "}
              <Num value={c("forfeitCooldownDays")} unit={days(c("forfeitCooldownDays"))} /> in een cooldown: het kan
              dan niet uitdagen of uitgedaagd worden.
            </li>
            <li>Een rating zakt nooit onder 0.</li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="uitstel"
        title="Uitstel in onderling overleg"
        lead={
          <>
            <p>
              Lukt het niet om binnen de speeltermijn te spelen, bijvoorbeeld door een blessure? Vraag dan vanaf de
              uitdaging uitstel aan: 1 tot en met <Num value={c("postponementMaxDays")} unit={days(c("postponementMaxDays"))} />.
              Het andere duo moet akkoord geven; eenzijdig uitstel bestaat niet.
            </p>
            <p>
              Gaat het andere duo akkoord, dan schuift de speeldeadline het gevraagde aantal dagen op. Wordt het
              verzoek geweigerd of komt er geen antwoord vóór de deadline, dan blijft de gewone speelverplichting
              gelden.
            </p>
          </>
        }
      >
        <Details summary="De regels op een rij">
          <BulletList>
            <li>Uitstel kan alleen voor een geaccepteerde uitdaging, vóór de speeldeadline en zolang er nog geen uitslag is ingevuld.</li>
            <li>Er staat steeds hooguit één verzoek open. Wie het verzoek deed, kan het intrekken zolang er nog niet op is gereageerd.</li>
            <li>
              Per uitdaging kan <Num value={c("postponementMaxPerChallenge")} unit="keer" /> uitstel
              worden gegeven. Geweigerde en ingetrokken verzoeken tellen niet mee.
            </li>
            <li>De nieuwe deadline is de deadline op het moment van accepteren plus het gevraagde aantal dagen.</li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="uitslag"
        title="De uitslag doorgeven"
        lead={
          <p>
            Na de wedstrijd vult één van beide duo&apos;s de setstanden in; het andere duo bevestigt. Pas dan verandert
            de rating. Reageert het andere duo niet binnen <Num value={c("autoConfirmHours")} unit="uur" />, dan wordt
            de uitslag automatisch bevestigd.
          </p>
        }
      >
        <Details summary="Welke uitslagen zijn geldig?">
          <BulletList>
            <li>Een wedstrijd heeft 2 of 3 sets en een duidelijke winnaar.</li>
            <li>Een gewone set eindigt op 6-0 tot en met 6-4, 7-5 of 7-6.</li>
            <li>
              Een beslissende derde set mag een match-tiebreak zijn: tot minimaal 10 punten met 2 punten verschil
              (bijvoorbeeld 10-8 of 12-10).
            </li>
          </BulletList>
        </Details>
        <Details summary="Walkover: de tegenstander kwam niet">
          <p>
            Kwam het andere duo niet opdagen, of zegde het vóór de start af? Dan meldt het duo dat er wél was een
            walkover. Die telt als 6-0 6-0 en loopt via de gewone ratingberekening, dus inclusief het maximale
            gamesaldo. Het is geen forfeit.
          </p>
          <p>
            Het andere duo krijgt de melding net als een gewone uitslag ter bevestiging, en kan er een geschil over
            openen.
          </p>
        </Details>
        <Details summary="Opgave: een duo stopt tijdens de wedstrijd">
          <p>
            Geeft een duo op, bijvoorbeeld door een blessure, dan vul je de stand in op het moment van opgave en kies
            je welk duo opgaf. Beide duo&apos;s kunnen dat doen. De gespeelde games blijven staan:
          </p>
          <BulletList>
            <li>
              De lopende set wordt afgemaakt in het voordeel van het duo dat doorspeelde: 6 games (7-5 of 7-6 als de
              stand al 5-5 of 6-5 of 6-6 was).
            </li>
            <li>Nog niet gespeelde sets tellen als 6-0 voor dat duo.</li>
            <li>
              Voorbeeld: geeft de tegenstander op bij 6-4 2-3, dan wordt de uitslag 6-4 6-3 voor het duo dat doorspeelde. De werkelijke
              stand blijft zichtbaar bij de wedstrijd.
            </li>
            <li>Stond de wedstrijd al vast, dan is het geen opgave: vul dan de gewone uitslag in.</li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="rating"
        title="De ELO-rating"
        lead={
          <>
            <p>
              De rating laat zien hoe sterk jullie duo nu speelt. Winnen levert punten op, verliezen kost punten, en
              hoeveel hangt af van de tegenstander:
            </p>
            <BulletList>
              <li>Win je van een sterker duo, dan krijg je veel punten; dat werd niet verwacht.</li>
              <li>Win je van een zwakker duo, dan krijg je weinig punten.</li>
              <li>Verlies je van een zwakker duo, dan verlies je juist veel punten.</li>
            </BulletList>
            <p>
              Ook het <strong>gamesaldo</strong> telt mee: een ruime zege (6-0 6-0) levert meer op dan een nipte zege
              in de match-tiebreak. De winnaar wint altijd minstens 1 punt, de verliezer verliest er altijd minstens 1.
            </p>
          </>
        }
      >
        <Details summary="Stap 1: de verwachte winkans">
          <Formula>E = 1 ÷ (1 + 10^((rating tegenstander − eigen rating) ÷ 400))</Formula>
          <p>
            Staan beide duo&apos;s gelijk, dan is de verwachte winkans 50%. Sta je 400 punten hoger, dan is die
            ongeveer 91%.
          </p>
        </Details>
        <Details summary="Stap 2: de K-factor">
          <p>De K-factor bepaalt hoe groot de sprongen zijn:</p>
          <BulletList>
            <li>
              <strong>K = {K.provisionalK}</strong> voor een duo met minder dan {K.provisionalMatchThreshold} gespeelde
              wedstrijden; die rating moet nog snel zijn niveau vinden.
            </li>
            <li>
              <strong>K = {K.topK}</strong> voor een gevestigd duo in de beste {Math.round(K.topPercentileThreshold * 100)}
              % van de ladder, zodat de top stabiel blijft.
            </li>
            <li>
              <strong>K = {K.establishedK}</strong> voor alle andere gevestigde duo&apos;s.
            </li>
          </BulletList>
          <p>
            Spelen dezelfde twee duo&apos;s binnen{" "}
            <Num value={c("repeatWindowDays")} unit={days(c("repeatWindowDays"))} /> nog een keer tegen elkaar, dan
            telt die wedstrijd half zo zwaar. Zo levert steeds hetzelfde duo uitdagen geen snelle punten op.
          </p>
        </Details>
        <Details summary="Stap 3: het gamesaldo">
          <p>
            Games worden geteld zoals de KNLTB dat doet: gewone sets tellen hun games, een match-tiebreak telt als één
            game (10-8 wordt 1-0).
          </p>
          <Formula>marge = (games winnaar − games verliezer) ÷ totaal aantal games</Formula>
          <Formula>
            factor = {fmt(c("marginMin") ?? DEFAULT_MARGIN_CONFIG.minMultiplier)} + (
            {fmt(c("marginMax") ?? DEFAULT_MARGIN_CONFIG.maxMultiplier)} −{" "}
            {fmt(c("marginMin") ?? DEFAULT_MARGIN_CONFIG.minMultiplier)}) × marge
          </Formula>
          <p>
            Bij de nipste zege is de factor {fmt(c("marginMin") ?? DEFAULT_MARGIN_CONFIG.minMultiplier)}, bij 6-0&nbsp;6-0 is die{" "}
            {fmt(c("marginMax") ?? DEFAULT_MARGIN_CONFIG.maxMultiplier)}. Heeft de winnaar minder games dan de
            verliezer, dan geldt de laagste factor: de zege telt volledig, alleen zonder bonus. Beide duo&apos;s krijgen
            dezelfde factor.
          </p>
        </Details>
        <Details summary="Stap 4: de nieuwe rating">
          <Formula>Δ winnaar = K × factor × (1 − E)</Formula>
          <Formula>Δ verliezer = −K × factor × E</Formula>
          <BulletList>
            <li>Er wordt symmetrisch afgerond, zodat winst en verlies bij gelijke K precies gelijk zijn.</li>
            <li>
              Eén wedstrijd verandert een rating nooit meer dan <strong>{RATING_CAP} punten</strong>, en een rating
              zakt nooit onder 0.
            </li>
          </BulletList>
        </Details>
        {example ? (
          <Details summary="Volledig uitgewerkt voorbeeld">
            <p>
              Duo A (rating 1450) verslaat duo B (rating 1380) met 6-4 6-3. Beide duo&apos;s zijn gevestigd en staan
              niet in de top, dus K = {K.establishedK}.
            </p>
            <div className="overflow-x-auto rounded-md bg-muted px-3 py-2.5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm whitespace-nowrap">
                <dt className="text-muted-foreground">Verwachte winkans A</dt>
                <dd className="tabular">{fmt(example.expected * 100, 0)}%</dd>
                <dt className="text-muted-foreground">Games (KNLTB)</dt>
                <dd className="tabular">{example.games}</dd>
                <dt className="text-muted-foreground">Marge</dt>
                <dd className="tabular">{fmt(example.margin)}</dd>
                <dt className="text-muted-foreground">Gamesaldo-factor</dt>
                <dd className="tabular">× {fmt(example.multiplier)}</dd>
                <dt className="text-muted-foreground">Duo A</dt>
                <dd className="tabular font-semibold text-win">
                  {example.winnerDelta > 0 ? "+" : ""}
                  {example.winnerDelta} → {example.winnerNew}
                </dd>
                <dt className="text-muted-foreground">Duo B</dt>
                <dd className="tabular font-semibold text-loss">
                  {example.loserDelta} → {example.loserNew}
                </dd>
              </dl>
            </div>
            <p>
              A was favoriet en wint, dus een bescheiden winst. Had B gewonnen, dan had B er juist meer punten bij
              gekregen, omdat die uitslag minder verwacht was.
            </p>
          </Details>
        ) : null}
      </InfoSection>

      <InfoSection
        id="statistieken"
        title="Statistieken"
        lead={
          <p>
            Naast de rating houdt de app per duo bij hoe het ervoor staat. Alles wordt afgeleid uit bevestigde
            wedstrijden en uitdagingen; niets wordt los bijgehouden.
          </p>
        }
      >
        <Details summary="Wat betekenen de cijfers?">
          <BulletList>
            <li>
              <strong>Winst–verlies en reeks:</strong> alleen bevestigde wedstrijden tellen. De reeks is het aantal
              gewonnen of verloren wedstrijden op rij. Een forfeit telt hier niet als verlies.
            </li>
            <li>
              <strong>Set- en gamesaldo:</strong> gewonnen min verloren sets en games, met dezelfde KNLTB-telling als
              de rating.
            </li>
            <li>
              <strong>Betrouwbaarheid:</strong> welk deel van de uitdagingen echt gespeeld is. Forfeits die aan het
              duo toe te rekenen zijn, tellen mee als niet gespeeld; een geweigerde uitdaging telt niet mee.
            </li>
            <li>
              <strong>Inactief:</strong> een duo dat langer dan{" "}
              <Num value={c("inactiveDays")} unit={days(c("inactiveDays"))} /> niets heeft gedaan (geen wedstrijd
              gespeeld, geen uitdaging verstuurd of geaccepteerd). Het label is alleen informatief.
            </li>
            <li>
              <strong>Wedstrijdhistorie en onderling resultaat:</strong> alle gespeelde wedstrijden, ongeldig
              verklaarde wedstrijden en forfeits van een duo, en de uitslagen tussen twee duo&apos;s.
            </li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="geschillen"
        title="Geschillen"
        lead={
          <p>
            Klopt een ingevoerde uitslag niet, of vind je een forfeit onterecht? Open een geschil met een toelichting.
            Zolang een geschil loopt, verandert er niets aan de rating. Een beheerder beslist.
          </p>
        }
      >
        <Details summary="Score-geschil: wat kan er gebeuren?">
          <BulletList>
            <li>
              <strong>Uitslag blijft staan:</strong> de rating wordt alsnog verwerkt, op het moment van de beslissing.
            </li>
            <li>
              <strong>Uitslag ongeldig:</strong> de wedstrijd telt niet mee. De uitdaging loopt door en jullie spelen
              opnieuw, met een nieuwe speeltermijn van{" "}
              <Num value={c("matchDays")} unit={days(c("matchDays"))} /> vanaf de beslissing (nooit korter dan de
              oorspronkelijke). Wordt de nieuwe wedstrijd niet op tijd gespeeld, dan volgt de gewone forfeit.
            </li>
          </BulletList>
        </Details>
        <Details summary="Forfeit-geschil: wat kan er gebeuren?">
          <p>
            Kan alleen bij een forfeit wegens niet spelen, tot{" "}
            <Num value={c("forfeitDisputeDays")} unit={days(c("forfeitDisputeDays"))} /> na de forfeit.
          </p>
          <BulletList>
            <li>
              <strong>Straf blijft staan</strong> voor beide duo&apos;s.
            </li>
            <li>
              <strong>Schuld bij één duo:</strong> alleen dat duo houdt de straf; bij het andere duo worden de punten
              teruggezet. Beide mutaties blijven zichtbaar in de historie.
            </li>
          </BulletList>
        </Details>
      </InfoSection>

      <InfoSection
        id="beschikbaarheid"
        title="Beschikbaarheid"
        lead={
          <>
            <p>
              Geef per duo aan wanneer jullie kunnen spelen. Kies snel een dagdeel (ochtend, middag of avond) of voer
              een eigen tijdsblok in met dag, begin- en eindtijd, elke week of eenmalig. Beide spelers kunnen blokken
              toevoegen, bewerken en verwijderen.
            </p>
            <p>
              Deze tijden zijn ook beschikbaar via een externe koppeling, bijvoorbeeld voor een club die baanplanning
              wil afstemmen. Daarin staan <strong>nooit</strong> e-mailadressen of gebruikers-id&apos;s, alleen de
              duo-naam, de regio en de tijdsblokken.
            </p>
          </>
        }
      />

      <InfoSection
        id="profiel"
        title="Profiel en e-mailmeldingen"
        lead={
          <>
            <p>
              Op je{" "}
              <Link href="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
                profiel
              </Link>{" "}
              stel je je naam in: zo zien je partner en tegenstanders je. Je e-mailadres is nooit zichtbaar voor andere
              spelers. Heb je nog geen naam ingesteld, dan zien anderen een neutrale naam als &ldquo;Speler 1A2B3C&rdquo;.
            </p>
            <p>
              Je kunt er ook je KNLTB-speelsterkte (1 tot en met 9) invullen. Die is zelf opgegeven en geen officiële
              KNLTB-rating: we controleren hem niet en hij telt niet mee voor je rating of voor wie je kunt uitdagen.
            </p>
          </>
        }
      >
        <Details summary="Welke e-mails krijg je?">
          <BulletList>
            <li>Een nieuwe uitdaging voor je duo.</li>
            <li>
              Een herinnering als de reactietermijn van een uitdaging bijna afloopt (
              <Num value={c("reminderResponseHours")} unit="uur" /> vooraf).
            </li>
            <li>
              Een herinnering als de speeltermijn bijna afloopt en er nog geen uitslag is (
              <Num value={c("reminderMatchHours")} unit="uur" /> vooraf).
            </li>
            <li>
              Een uitslag die op jullie bevestiging wacht, plus een herinnering{" "}
              <Num value={c("reminderAutoConfirmHours")} unit="uur" /> voordat hij automatisch definitief wordt.
            </li>
            <li>De afhandeling van een geschil door een beheerder.</li>
            <li>Uitstelverzoeken en de antwoorden daarop.</li>
          </BulletList>
          <p>Elke soort zet je aan of uit op je profiel. Standaard staat alles aan.</p>
        </Details>
      </InfoSection>

      <InfoSection
        id="beheer"
        title="Voor beheerders"
        lead={
          <p>
            Beheerders handelen geschillen af, beheren de API-sleutels voor de externe koppeling, wijzen andere
            beheerders aan en zien alle instelbare waarden op deze pagina op één centrale plek terug.
          </p>
        }
      />
    </Page>
  );
}

function KeyFigure({
  label,
  value,
  unit,
  unitFirst = false,
}: {
  label: string;
  value: number | null;
  unit?: string;
  unitFirst?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-1 bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        {unitFirst && unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        <span className="font-score text-[2rem]">{value === null ? "—" : fmt(value)}</span>
        {!unitFirst && unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </dd>
    </div>
  );
}
