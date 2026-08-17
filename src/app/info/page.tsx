import type { ReactNode } from "react";

const h2Style = { fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, margin: "0 0 8px" } as const;
const h3Style = { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, margin: "20px 0 6px" } as const;
const pStyle = { fontSize: 15, lineHeight: 1.65, margin: 0 } as const;
const ulStyle = { fontSize: 15, lineHeight: 1.75, margin: "8px 0 0", paddingLeft: 20 } as const;

function DetailBox({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="card" style={{ borderRadius: 0, marginTop: 16 }}>
      <summary
        style={{
          cursor: "pointer",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {summary}
      </summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-neutral-100)",
        padding: "10px 14px",
        margin: "10px 0",
        fontFamily: "monospace",
        fontSize: 13,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

export default function InfoPage() {
  return (
    <>
      <section
        style={{
          position: "relative",
          padding: "clamp(56px,9vw,100px) clamp(20px,4vw,48px)",
          backgroundImage:
            "linear-gradient(180deg, rgba(20,20,20,0.55), rgba(20,20,20,0.85)), url(/images/net-closeup.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", color: "var(--color-bg)" }}>
          <div className="tag tag-accent" style={{ marginBottom: 10 }}>
            Uitleg
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,40px)", margin: 0 }}>
            Hoe werkt Padel Ladder?
          </h1>
          <p style={{ fontSize: 15, margin: "12px 0 0", maxWidth: "65ch", opacity: 0.9 }}>
            Alles over de app, van de ladder tot precies hoe de ELO-rating wordt uitgerekend. Elk
            onderdeel heeft een korte uitleg, en waar het nuttig is een uitklapbaar blok met alle
            details en de exacte getallen die deze app gebruikt.
          </p>
        </div>
      </section>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8">

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>1. De ladder</h2>
        <p style={pStyle}>
          Alle duo&apos;s in een regio staan op één ranglijst: de ladder. Hoe hoger je rating, hoe hoger je
          staat. Sta je gelijk met een ander duo? Dan wint het duo dat het langst meedoet (oudste
          inschrijving eerst).
        </p>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Je positie en je tier staan nooit vast opgeslagen — ze worden elke keer opnieuw uitgerekend op
          basis van de actuele rating. Verandert je rating, dan verandert automatisch ook je positie.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>2. Tiers (niveaugroepen)</h2>
        <p style={pStyle}>
          De ladder is opgedeeld in <strong>tiers</strong>: stroken van steeds evenveel punten breed. Je
          tier bepaal je niet zelf — hij volgt automatisch uit je rating. Duo&apos;s in dezelfde tier zijn
          ongeveer even sterk, en dat zijn ook de enige duo&apos;s die je mag uitdagen.
        </p>
        <DetailBox summary="Uitgebreide uitleg: hoe wordt mijn tier berekend?">
          <p style={pStyle}>
            Je tier is je rating gedeeld door de tier-breedte, afgerond naar beneden:
          </p>
          <Formula>tier = afgerond naar beneden (rating ÷ tier-breedte)</Formula>
          <p style={pStyle}>
            Deze app gebruikt op dit moment een tier-breedte van <strong>100 punten</strong>. Dat betekent
            bijvoorbeeld:
          </p>
          <ul style={ulStyle}>
            <li>rating 1450 → tier 14 (want 1450 ÷ 100 = 14,5 → naar beneden afgerond: 14)</li>
            <li>rating 1099 → tier 10</li>
            <li>rating 1100 → tier 11</li>
          </ul>
          <p style={{ ...pStyle, marginTop: 8 }}>
            De tier-breedte staat in de beheerinstellingen (<code>rating_tier_size</code>) en kan per
            seizoen worden aangepast — nooit hardcoded ergens in de code.
          </p>
        </DetailBox>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>3. Meerdere duo&apos;s tegelijk</h2>
        <p style={pStyle}>
          Je hoeft niet te kiezen: je mag met verschillende vaste partners in meerdere duo&apos;s tegelijk
          spelen (tot een maximum van <strong>5 actieve duo&apos;s per speler</strong> dit seizoen). Elk
          duo heeft zijn eigen plek op de ladder, zijn eigen rating en zijn eigen wedstrijdgeschiedenis —
          die worden nooit gemengd.
        </p>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Wel geldt: dezelfde twee spelers kunnen nooit twee keer tegelijk een actief duo vormen. Wil je
          een keer met een andere combinatie spelen? Dan moet één van je bestaande duo&apos;s eerst
          ontbonden worden (dat vereist bevestiging van beide spelers).
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>4. Uitdagen (challenges)</h2>
        <p style={pStyle}>
          Vanaf de ladder kun je een duo in jouw eigen tier uitdagen. Dat duo krijgt een aantal dagen de
          tijd om te reageren. Reageert het niet op tijd, dan wordt de uitdaging automatisch als verlopen
          gemarkeerd en krijgt het <strong>niet-reagerende</strong> duo een vaste puntenstraf (zie
          &ldquo;Forfeit-penalty&rdquo; hieronder) — het duo dat wél uitdaagde, wordt niet gestraft.
        </p>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Accepteert het duo de uitdaging, dan hebben beide duo&apos;s daarna een periode om de wedstrijd
          ook echt te spelen. Gebeurt dat niet op tijd, dan telt dat ook als forfeit — maar dan voor{" "}
          <strong>beide</strong> duo&apos;s, want beide hadden de afspraak kunnen nakomen.
        </p>
        <DetailBox summary="Uitgebreide uitleg: alle termijnen op een rij">
          <ul style={ulStyle}>
            <li>Reageren op een uitdaging: <strong>5 dagen</strong>, anders verloopt hij (forfeit voor het uitgedaagde duo).</li>
            <li>Na accepteren de wedstrijd spelen: <strong>14 dagen</strong>, anders forfeit voor beide duo&apos;s.</li>
            <li>
              Net een forfeit-penalty gehad? Dan zit een duo <strong>3 dagen</strong> in een cooldown en kan
              het in die periode niet uitdagen of uitgedaagd worden — zo kan een duo dat de deadline net
              gemist heeft niet meteen weer onder druk gezet worden.
            </li>
          </ul>
        </DetailBox>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>5. De wedstrijd spelen en de score doorgeven</h2>
        <p style={pStyle}>
          Na het spelen vult één van de twee duo&apos;s de setstanden in. Het andere duo krijgt dat te zien
          en moet het bevestigen — pas dán wordt de rating aangepast. Reageert niemand binnen de
          bevestigingstermijn, dan wordt de score automatisch als bevestigd beschouwd (auto-bevestiging),
          zodat een wedstrijd niet eeuwig kan blijven &ldquo;hangen&rdquo;.
        </p>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Klopt de score niet volgens het andere duo? Dan kan het in plaats van bevestigen een geschil
          openen (zie punt 7).
        </p>
      </section>

      <div
        style={{
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          height: "clamp(180px,26vw,320px)",
          backgroundImage: "url(/images/court-high.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          filter: "grayscale(1)",
        }}
      />

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>6. De ELO-rating</h2>

        <h3 style={h3Style}>Simpele uitleg</h3>
        <p style={pStyle}>
          Elk duo heeft een rating: een getal dat laat zien hoe goed jullie op dit moment spelen. Win je,
          dan gaat je rating omhoog. Verlies je, dan gaat je rating omlaag. Maar hoeveel punten je wint of
          verliest, hangt af van wie je tegenover je hebt:
        </p>
        <ul style={ulStyle}>
          <li>
            Win je van een duo dat <strong>hoger</strong> staat (sterker is)? Dan krijg je veel punten — dat
            werd niet verwacht.
          </li>
          <li>
            Win je van een duo dat <strong>lager</strong> staat (zwakker is)? Dan krijg je maar weinig
            punten — dat was ook wel de bedoeling.
          </li>
          <li>Verlies je van een sterker duo? Dan verlies je maar weinig punten.</li>
          <li>Verlies je van een zwakker duo? Dan verlies je juist veel punten — dat had niet gemogen!</li>
        </ul>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Zo past je rating zich steeds aan, tot hij precies laat zien hoe goed je écht bent. Win je vaker
          dan verwacht, dan stijgt je rating gestaag. Verlies je vaker dan verwacht, dan zakt hij.
        </p>

        <DetailBox summary="Uitgebreide uitleg: de exacte berekening (met formules)">
          <p style={pStyle}>
            Elk duo begint met een startrating van <strong>1200</strong> punten. Na elke bevestigde
            wedstrijd wordt de rating in drie stappen herberekend.
          </p>

          <h3 style={h3Style}>Stap 1 — de verwachte winkans</h3>
          <p style={pStyle}>
            Eerst wordt berekend hoe groot de kans was dat jullie duo zou winnen, puur op basis van het
            ratingverschil:
          </p>
          <Formula>verwachte winkans = 1 ÷ (1 + 10^((rating tegenstander − eigen rating) ÷ 400))</Formula>
          <p style={pStyle}>
            Dit getal ligt altijd tussen 0 en 1 (0% en 100%). Staan beide duo&apos;s precies gelijk, dan is
            de verwachte winkans voor allebei 50%. Sta je 400 punten hoger dan je tegenstander, dan is je
            verwachte winkans ongeveer 91%.
          </p>

          <h3 style={h3Style}>Stap 2 — de K-factor (hoeveel staat er op het spel)</h3>
          <p style={pStyle}>
            De K-factor bepaalt hoe groot de puntensprongen maximaal zijn. Nieuwe duo&apos;s en duo&apos;s
            aan de absolute top krijgen een andere K-factor dan de rest:
          </p>
          <ul style={ulStyle}>
            <li>
              <strong>K = 40</strong> voor een duo dat nog geen 10 wedstrijden heeft gespeeld
              (&ldquo;voorlopige&rdquo; rating — die moet nog snel zijn niveau vinden).
            </li>
            <li>
              <strong>K = 16</strong> voor een duo dat al 10+ wedstrijden speelde én bij de beste 10% van
              de ladder hoort (voorkomt dat de nummer 1 op en neer blijft schieten).
            </li>
            <li>
              <strong>K = 24</strong> voor alle overige, &ldquo;gevestigde&rdquo; duo&apos;s.
            </li>
          </ul>
          <p style={{ ...pStyle, marginTop: 8 }}>
            Spelen dezelfde twee duo&apos;s binnen <strong>14 dagen</strong> nóg een keer tegen elkaar? Dan
            wordt de K-factor voor die wedstrijd gehalveerd. Dat voorkomt dat twee bevriende duo&apos;s
            elkaar steeds opnieuw uitdagen om snel punten te scoren.
          </p>

          <h3 style={h3Style}>Stap 3 — de nieuwe rating</h3>
          <p style={pStyle}>De ratingverandering (het aantal punten erbij of eraf) is:</p>
          <Formula>Δ rating = K-factor × (werkelijke uitslag − verwachte winkans)</Formula>
          <p style={pStyle}>
            Waarbij de werkelijke uitslag <strong>1</strong> is bij winst en <strong>0</strong> bij verlies.
            De winnaar krijgt dus altijd een positieve Δ, de verliezer altijd een negatieve — en beide
            Δ&apos;s zijn (bij gelijke K-factor) elkaars spiegelbeeld.
          </p>
          <p style={{ ...pStyle, marginTop: 8 }}>Twee ingebouwde grenzen zorgen dat het nooit gek uitpakt:</p>
          <ul style={ulStyle}>
            <li>Een enkele wedstrijd kan je rating nooit met meer dan <strong>50 punten</strong> laten stijgen of dalen.</li>
            <li>Je rating kan nooit onder <strong>0</strong> komen.</li>
          </ul>

          <h3 style={h3Style}>Volledig uitgewerkt voorbeeld</h3>
          <p style={pStyle}>
            Duo A (rating 1450, 20 wedstrijden gespeeld, niet in de top 10%) verslaat duo B (rating 1380,
            ook gevestigd):
          </p>
          <Formula>
            verwachte winkans A = 1 ÷ (1 + 10^((1380 − 1450) ÷ 400)) ≈ 0,60 (60%)
            <br />
            K-factor A = 24 (gevestigd, niet top 10%)
            <br />
            Δ rating A = 24 × (1 − 0,60) = 24 × 0,40 ≈ +10 punten → nieuwe rating: 1460
            <br />
            <br />
            verwachte winkans B = 1 − 0,60 = 0,40 (40%)
            <br />
            K-factor B = 24
            <br />
            Δ rating B = 24 × (0 − 0,40) = 24 × −0,40 ≈ −10 punten → nieuwe rating: 1370
          </Formula>
          <p style={pStyle}>
            Duo A was favoriet (60% winkans) en wint ook — dus een bescheiden puntenwinst. Had het
            ondergeschikte duo B gewonnen, dan had B er juist méér punten bij gekregen (K × (1 − 0,40) = 24
            × 0,60 ≈ +14), omdat die uitslag minder werd verwacht.
          </p>
        </DetailBox>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>7. Forfeit-penalty</h2>
        <p style={pStyle}>
          Een forfeit-penalty is <strong>geen</strong> ELO-berekening — het is een vaste, van tevoren
          ingestelde puntenstraf (op dit moment <strong>10 punten</strong>), die wordt afgetrokken van de
          rating van het duo dat in gebreke is gebleven.
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Niet gereageerd</strong> op een uitdaging binnen 5 dagen → alleen het uitgedaagde duo
            krijgt de straf.
          </li>
          <li>
            <strong>Niet gespeeld</strong> binnen 14 dagen na acceptatie → beide duo&apos;s krijgen de
            straf (allebei hadden de afspraak kunnen nakomen).
          </li>
        </ul>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Zo&apos;n straf raakt daarna nooit op onder de 0 punten, en start een cooldown van 3 dagen (zie
          punt 4).
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>8. Geschillen (disputes)</h2>
        <p style={pStyle}>
          Er zijn twee soorten geschillen die je kunt openen:
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Score-geschil:</strong> je bent het niet eens met een ingevoerde uitslag. In plaats van
            te bevestigen, open je een geschil met een toelichting.
          </li>
          <li>
            <strong>Forfeit-geschil:</strong> je vindt dat een opgelegde forfeit-penalty onterecht was
            (bijvoorbeeld omdat je wél op tijd probeerde te spelen). Dit kan tot 5 dagen na de forfeit.
          </li>
        </ul>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Een beheerder bekijkt elk geschil en beslist: de oorspronkelijke uitslag/straf handhaven, de
          wedstrijd ongeldig verklaren, of — bij een forfeit-geschil — de straf alsnog eenzijdig aan één van
          de twee duo&apos;s toewijzen. Wordt een score alsnog goedgekeurd, dan wordt de ELO-berekening pas
          op dat moment alsnog verwerkt.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>9. Beschikbaarheid</h2>
        <p style={pStyle}>
          Geef per dag aan wanneer jullie duo &apos;s ochtends, &apos;s middags of &apos;s avonds kan
          spelen, zodat een tegenstander na een geaccepteerde uitdaging makkelijk een moment kan vinden.
        </p>
        <p style={{ ...pStyle, marginTop: 8 }}>
          Deze gegevens zijn ook te zien via een externe API (bijvoorbeeld voor een vereniging die
          baanplanning wil combineren). Daarin wordt <strong>nooit</strong> een e-mailadres of gebruikers-id
          gedeeld — alleen de duo-naam, de regio en het tijdsblok.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section>
        <h2 style={h2Style}>10. Voor beheerders</h2>
        <p style={pStyle}>
          Beheerders kunnen openstaande geschillen beoordelen, API-clients voor de externe koppeling
          aanmaken en intrekken, en op de configuratiepagina alle instelbare waarden uit deze uitleg (de
          tier-breedte, deadlines, penalty&apos;s, het maximum aantal duo&apos;s) terugvinden — nooit
          hardcoded, altijd op één centrale plek aanpasbaar.
        </p>
      </section>
      </main>

      <div
        style={{
          height: "clamp(200px,30vw,360px)",
          backgroundImage: "url(/images/paddle-serve.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          filter: "grayscale(1)",
        }}
      />
    </>
  );
}
