# Court — Design System Padel Ladder

> Briefing voor iedereen (mens of agent) die een pagina herontwerpt.
> Vervangt het "Modernist"-design system (`src/app/design-system.css` is verwijderd;
> `/websitedesign` is **verouderd** — niet meer als referentie gebruiken).
> Levende catalogus: **`/design`** (alleen in `npm run dev`, 404 in productie).

Stack: Tailwind **v4** (CSS-first, geen `tailwind.config.ts`) · shadcn/ui (stijl `new-york`,
Radix via `radix-ui`) · Kokonut UI · Bklit UI (charts, visx) · Motion (`motion/react`) ·
next-themes · sonner · lucide-react. **Next 14.2 + React 18 blijven** — zie §9.

---

## 1. Identiteit in één zin

Een padelbaan van bovenaf: **baanblauw** (court blue) als merk- en actiekleur, een **optic-gele
bal** als enige felle accent, koel **glas-grijs** als ondergrond, en **smalle scorebord-cijfers**
(Barlow Condensed) voor alles wat telt: rating, rang, uitslag. Mobiel eerst (390×844).

Principes:
1. **Cijfers zijn de held.** Ratings/posities altijd in `font-score` (condensed, tabular). Groot en zelfverzekerd; de rest van de UI is rustig.
2. **Geel is schaars.** `ball` alleen voor: positie #1, de actieve tab in de onderbalk, en hooguit één primaire "hero"-actie per scherm (`<Button variant="ball">`). Nooit als tekstkleur op licht.
3. **Eén court-vlak per pagina.** Het diepblauwe `court`-oppervlak (met baanlijnen) markeert het belangrijkste blok (bijv. "jouw duo"). Niet elk blok is een hero.
4. **Snel en stil bewegen.** Beweging beantwoordt een actie of onthult data; nooit decoratie (§6).
5. **Nederlands, zinsopbouw (sentence case), geen ALL-CAPS-labels**, geen "→" achter knoppen.

---

## 2. Tokens

Gedefinieerd in `src/app/globals.css` (`:root` en `.dark:has([data-kit])`), als Tailwind-kleuren
beschikbaar via `@theme inline`. **Gebruik altijd de semantische utilities, nooit hex-waarden of
Tailwind-paletkleuren (`zinc-*`, `blue-*`).** Het `neutral-*`-palet is uitgeschakeld.

### Kleur

| Utility (bg-/text-/border-) | Licht | Donker | Gebruik |
|---|---|---|---|
| `background` / `foreground` | #F2F4F8 / #0A1733 | #07112A / #EAF0FB | Pagina-ondergrond / hoofdtekst (ink) |
| `card` / `card-foreground` | #FFFFFF | #0E1B3D | Kaarten, secties, zijbalk |
| `popover` | #FFFFFF | #111F45 | Dialog, drawer, dropdown, select |
| `primary` / `primary-foreground` | #1F45C8 / wit | #7C9BFF / navy | Merk, primaire knop, links, actieve nav |
| `primary-soft` | #E6ECFB | #16275A | Getinte achtergrond (eigen duo-rij, soft-knop, badges) |
| `secondary`, `muted`, `accent` | grijs-blauw tinten | idem donker | Secundaire knop / rustige vlakken / **hover-ondergrond** (shadcn-semantiek: `accent` is GEEN merkkleur!) |
| `muted-foreground` | #52607A | #9AA8C4 | Secundaire tekst (≥5.7:1) |
| `border` / `input` | #DDE3EC / #7C889F | #1E2D55 / #50639A | Scheidingslijnen / formulierranden (≥3:1) |
| `ring` | = primary | = ball | Focusring (altijd zichtbaar) |
| `ball` / `ball-foreground` | #D6F23C / #0A1733 | idem | Zie principe 2 |
| `court` / `court-foreground` / `court-muted` | #132F9A / wit / #B8C6F5 | #15307F | Hero-vlak |
| `win` + `win-soft` | #0F7A3D / #E3F4EA | #3FD688 / #10343A | Winst, ratingstijging, "Voltooid" |
| `loss` + `loss-soft` | #B3232D / #FBE6E7 | #FF8A8F / #3A1C33 | Verlies, ratingdaling, forfeit |
| `warning` + `warning-soft` | #8F5100 / #FBF0DC | #F5B94A / #33290F | Betwist, deadline nadert, in afwachting |
| `destructive` | #C62A34 | #FF7A80 | Destructieve acties (weigeren, opheffen) |
| `chart-1…5`, `chart-grid` | — | — | Bklit-series (zie §5.4) |

Alle tekstcombinaties hierboven halen WCAG AA (≥4.5:1); gecontroleerd met een contrastscript.
Gebruik tinten met opacity alleen voor vlakken (`bg-primary/10`), niet voor tekst.

### Typografie (`next/font/google`, in `src/app/layout.tsx`)

| Rol | Font | Utility |
|---|---|---|
| Display: h1–h4, kaarttitels, cijfers | **Barlow Condensed** 600/700 (+ italic) | `font-display` |
| Cijfers (rating, rang, score) | Barlow Condensed 700, tabular, lh 1 | `font-score` |
| Body, UI, formulieren | **Instrument Sans** (variabel) | `font-sans` (default) |
| Tabulaire cijfers in lopende tekst/tabellen | — | `tabular` |

Schaal (mobiel → ≥sm): paginatitel `text-[2.125rem] → sm:text-[2.75rem]` (PageHeader doet dit),
sectietitel `text-[1.375rem]`, kaarttitel `text-xl`, body `0.9375rem` (15px), meta `text-sm`/`text-xs`.
Formuliervelden zijn op mobiel **16px** (voorkomt iOS-zoom) — shadcn `Input` en legacy `.input` regelen dit.
Getallen: **geen duizendtalscheiding** (`1395`, niet `1.395`) → gebruik `formatRating()`.

### Radius, schaduw, ruimte

- Radius: `rounded-sm` 6px (kleine badges) · `rounded-md` 10px (knoppen, inputs) · `rounded-lg` 12px · `rounded-xl` 16px (kaarten/secties) · `rounded-2xl` 22px (court-vlak, drawer) · `rounded-full` (pills/badges). Hiërarchie: hoe groter het vlak, hoe ronder.
- Schaduw: `shadow-card` (standaard kaart) · `shadow-raised` (court-vlak, popovers) · `shadow-nav` (tab-bar). In dark mode vervangen randen de schaduw.
- Ruimte: pagina-gutter 16px mobiel / 24px sm / 32px lg (via `<Page>`), verticale ritmiek `gap-6` tussen secties, `gap-3` binnen grids van kaarten, kaartpadding `p-4 sm:p-5`.
- Touch targets ≥ 40px (knoppen `h-10` standaard, `size="lg"` = 48px voor de hoofdactie op mobiel).

### Dark mode

`next-themes` zet `.dark` op `<html>` (standaard = systeemvoorkeur; toggle in zijbalk en "Meer").
**Tijdens de migratie werkt dark mode alleen op pagina's met `data-kit`** (de `<Page>`-component
zet dat). Legacy-pagina's hebben hardgecodeerde lichte aannames (witte hero-tekst via
`--color-bg`) en blijven daarom licht. Na migratie van de laatste pagina: in `globals.css`
`.dark:has([data-kit])` → `.dark` en de `@custom-variant dark` idem vereenvoudigen.
Gebruik `dark:`-varianten spaarzaam — de tokens flippen al vanzelf.

---

## 3. App-shell (al gebouwd — niet per pagina herhalen)

- `src/app/layout.tsx`: fonts, `<Providers>` (theme, MotionConfig reducedMotion="user", LazyMotion, TooltipProvider, Toaster), skip-link "Naar inhoud", `#inhoud` met onderpadding voor de tab-bar.
- `src/components/NavBar.tsx`:
  - **< lg**: sticky app-bar (merk + Inloggen/Uitloggen) en vaste **tab-bar onderin**: Ladder · Mijn duo's · Challenges · Rating · **Meer** (drawer met Beschikbaarheid, Uitleg, Beheer-links voor admins, thema-toggle).
  - **≥ lg**: vaste **zijbalk** links (256px, layout heeft `lg:pl-64`).
  - Linkteksten/hrefs zijn identiek aan de oude NavBar; admin-links via `getStoredRole()`.
- `src/app/template.tsx`: page-enter (fade + 6px, 180ms) bij client-navigatie; niet bij eerste load.
- Pagina's hoeven **geen** eigen nav, footer of ondermarge voor de tab-bar toe te voegen.

---

## 4. Componenten — welke wanneer

Importeer altijd per bestand (geen barrels). Alle paden onder `src/components/`.

### 4.1 App-bouwstenen (`app/`) — eerste keus

| Component | Gebruik |
|---|---|
| `Page` (`app/Page`) | Root van elke geherontworpen pagina. `width="narrow" \| "default" \| "wide"`. Zet `data-kit`. |
| `PageHeader` | Enige `<h1>` + beschrijving, `back={{href,label}}`, `actions`, `meta` (badges). |
| `SectionCard` | Blok met h2-kop, `description`, `action`. `variant="default" \| "court" \| "plain"`, `flush` voor lijsten/tabellen tot de rand. |
| `StatCard` | Kerngetal. `value` (ReactNode, bv. `<AnimatedNumber>`), `delta`, `hint`, `icon`, `trailing` (sparkline), `emphasis` (court, max 1). Grid: `grid grid-cols-2 gap-3 lg:grid-cols-4`. |
| `EmptyState` | Lege toestand met icoon, feitelijke titel, uitleg en één actie. `compact` binnen kaarten. |
| `RatingDelta` | +12/−8/±0 met pijl en kleur. `variant="pill" \| "inline"`, `forfeit` (gestreept + label; forfeit is nooit ELO), `tone="court"` op court-vlakken. |
| `RankBadge` | Ladderpositie. #1 geel, #2–3 soft, rest neutraal. `size="sm" \| "md" \| "lg"`. |
| `TierBadge` | "Tier n" met ladder-glyph. `variant="court"` op court-vlak. Tier komt uit de API, nooit zelf berekenen. |
| `DuoAvatar` | Initialen op deterministische clubkleur. `own` = gele ring. Decoratief (aria-hidden) tenzij `label`. |
| `AnimatedNumber` | Telt naar nieuwe waarde bij wijziging (SSR toont eindwaarde). `animateOnMount` spaarzaam. |
| `LoadingSkeletons` | `ListSkeleton`, `TableSkeleton`, `CardSkeleton`, `StatGridSkeleton`, `ChartSkeleton` — bootsen de echte layout na; nooit een spinner voor content. |
| `RatingChart` / `RatingSparkline` | Bklit-wrappers, lazy geladen. Data via `toRatingSeries(history)` (`app/rating-series`). `tierSize` tekent tier-grenzen. |
| `BrandMark` / `BrandLockup` | Logo (al in de shell). |
| `format.ts` | `formatRating`, `formatSignedDelta`, `duoInitials` (pure, getest). |
| `motion.ts` | Motion-tokens en varianten (`fadeUp`, `staggerList`, `transition.*`). |

### 4.2 shadcn/ui-primitives (`ui/`)

`button`, `badge`, `card`, `input`, `textarea`, `label`, `select`, `checkbox`, `radio-group`,
`switch`, `toggle`, `toggle-group`, `form` (react-hook-form + zod), `dialog`, `sheet`, `drawer`
(vaul), `popover`, `dropdown-menu`, `tooltip`, `tabs`, `table`, `scroll-area`, `separator`,
`skeleton`, `avatar`, `progress`, `sonner`.

Court-aanpassingen:
- **Button** varianten: `default` (primair), `ball` (hero-actie, max 1/scherm), `soft`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Maten `xs`/`sm`/`default` (40px)/`lg` (48px)/`icon*`.
- **Badge** varianten: `default`, `soft`, `muted`, `win`, `loss`, `warning`, `ball`, `outline`, `secondary`, `destructive`.
- **Card**: `CardTitle` is display-font `text-xl`; padding 20px.
- Alle componenten zijn met **`React.forwardRef`** herschreven (React 18: `asChild`/`Slot`, react-hook-form en Radix-positionering hebben refs nodig). Nieuw toegevoegde shadcn-componenten eerst net zo omzetten (§9).
- Dialog/Sheet/Drawer: popover-oppervlak, navy-overlay met lichte blur, sr-only "Sluiten".
- Toasts: `import { toast } from "sonner"` → `toast.success("Uitdaging verstuurd")`. Werkwoord uit de knop herhalen.

Keuzehulp:
- Bevestiging op **mobiel** → `SmoothDrawer` (bottom sheet). Op desktop mag `Dialog`. Onomkeerbaar én frequent → `HoldButton`.
- Statuslabels (Uitgedaagd, Geaccepteerd, Betwist, Voltooid, Verlopen) → `Badge` met `soft` / `warning` / `win` / `muted`; nooit alleen kleur, altijd tekst.
- Lange lijsten (ladder) op mobiel → lijst-rijen (`<ol>` met RankBadge/DuoAvatar/naam/rating), op ≥ md mag `Table`. Behoud de bestaande data-attributen en teksten waar e2e-tests op leunen (zie §8).

### 4.3 Kokonut UI (`kokonutui/`) — aangepast, default exports

| Bestand | Export | Gebruik |
|---|---|---|
| `hold-button.tsx` | `HoldButton` | Vasthouden om te bevestigen (`onConfirm`, `holdDuration` 1200ms, `tone`), muis/touch/toetsenbord. Bijv. "Duo opheffen". |
| `smooth-drawer.tsx` | `SmoothDrawer` | Bottom sheet met gestaggerde reveal; `trigger`, `title`, `description`, `footer`, controlled of niet. |
| `switch-button.tsx` | `SwitchButton` | Thema-toggle (al in de shell). |
| `apple-activity-card.tsx` | `ActivityRings` | Concentrische voortgangsringen (speelverplichting, winstpercentage). |
| `slide-text-button.tsx` | `SlideTextButton` | Eén marketing-CTA (landing). Link met hover-tekstslide. |

De originele demo's waren niet productierijp (hardcoded tekst, geen callbacks, zinc-kleuren);
alle vijf zijn herschreven op tokens met behoud van attributie-header.

### 4.4 Bklit UI (`charts/`)

Area-/line-chart met grid, x/y-as en tooltip (visx 4 alpha, React 18-compatibel). Gebruik in
pagina's **alleen via `RatingChart`/`RatingSparkline`** (lazy, gelokaliseerd, y-as passend op
data via `ChartYDomainFit`). Voor een nieuw charttype: component uit `charts/` direct gebruiken
binnen een eigen `*.impl.tsx` + `next/dynamic({ ssr: false })`-wrapper, kleuren via
`var(--chart-*)`. Lokale wijzigingen t.o.v. de registry: `nl-NL`-formatters, React 18-reftypes,
`ChartYDomainFit`, geen `any`.

---

## 5. Patronen

```tsx
// Pagina-skelet
<Page>                                   {/* width="wide" voor dashboards */}
  <PageHeader title="Challenges" description="Openstaande en gespeelde uitdagingen." />
  <SectionCard title="Open" flush>…lijst…</SectionCard>
</Page>

// Lijst-rij (ladder)
<li className="flex items-center gap-3 border-t px-4 py-3 data-own:bg-primary-soft/60" data-own={own || undefined}>
  <RankBadge position={p} size="sm" />
  <DuoAvatar name={name} size="sm" own={own} />
  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="text-xs text-muted-foreground">…</p></div>
  <RatingDelta value={delta} />
  <span className="font-score text-xl">{formatRating(rating)}</span>
</li>

// Laden → leeg → data
{loading ? <ListSkeleton rows={6} /> : items.length === 0 ? <EmptyState … /> : <ol>…</ol>}

// Fout
<div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
  Kon de ladder niet laden. Probeer het opnieuw.
</div>
```

Copy: actief en concreet ("Verstuur uitdaging", niet "Verzenden"); fouten zeggen wat er mis is
en wat nu; lege toestanden nodigen uit tot de volgende stap.

---

## 6. Motion

- Provider: `MotionConfig reducedMotion="user"` + `LazyMotion features={domMax}`. Gebruik in app-code **`m.div`** (niet `motion.div`) — kleiner per component.
- Tokens uit `app/motion.ts`: `transition.fast` (160ms), `transition.base` (220ms), `transition.spring` (indicatoren/layout), ease `EASE_SNAP`.
- **Wel**: page-enter (al in template), gestaggerde lijst-entree (≤ 8 items, `staggerList` + `fadeUp`), `layoutId`-indicatoren voor tabs/segmenten, getal-tweens (`AnimatedNumber`), chart-onthulling, drawer/dialog open/dicht, knopdruk (`active:scale-[0.97]`, zit al in Button).
- **Niet**: hover-animaties op elke kaart, oneindige loops (behalve laadtoestanden), parallax, entree-animaties op elke sectie, animaties > 400ms (behalve data-onthulling).
- Reduced motion: transforms vallen automatisch weg; CSS-transities/animaties worden globaal ~0ms; `AnimatedNumber` en charts springen direct. Test met DevTools → Rendering → prefers-reduced-motion.

## 7. Do / Don't

| Do | Don't |
|---|---|
| Semantische tokens (`bg-card`, `text-muted-foreground`, `text-win`) | Hex, `zinc-*`, `neutral-*`, `text-muted` (bestaat bewust niet) |
| `font-score` voor elk getal dat telt | Rating in body-font of met duizendtalpunt |
| Eén court-vlak, één `ball`-knop per scherm | Overal geel of blauwe vlakken |
| Kleur + tekst/icoon voor status | Alleen kleur (rood/groen) |
| `<Page>` + `PageHeader` op elke pagina | Eigen paddings/maxbreedtes per pagina |
| `SmoothDrawer`/`Sheet` op mobiel | Gecentreerde modals met lange formulieren op 390px |
| Zichtbare focus (zit in tokens) | `outline-none` zonder vervangende ring |
| Skeletons die de layout nabootsen | Spinner in het midden van een lege pagina |
| Nederlands, sentence case | ALL-CAPS-labels, "→" achter knoppen, eyebrows boven elke kop |

---

## 8. Migratierecept: pagina van legacy naar Court

Legacy-klassen (`.btn`, `.card`, `.tag`, `.table`, `.field`, `.input`, `.hr`, `.text-muted`, …)
en legacy-variabelen (`var(--color-accent-700)`, `var(--font-heading)`, …) werken nog via
`src/styles/legacy.css` (laag `legacy`, onder de Tailwind-utilities) en zijn al op Court-tokens
gezet. Per pagina:

1. **Root**: vervang de buitenste `<main className="mx-auto … px-4 py-8 …">` door `<Page width=…>`. Dat zet `data-kit`: legacy element-defaults (h1-maat, p-marge, onderstreepte links) vervallen en dark mode gaat aan → controleer de pagina in beide thema's.
2. **Kop**: `<h1>` + intro → `<PageHeader title description actions />`. **Behoud exacte kopteksten** (e2e: `getByRole("heading", { name: "Mijn duo's" })`).
3. **Klassen vervangen**:

   | Legacy | Court |
   |---|---|
   | `btn btn-primary` | `<Button>` |
   | `btn btn-secondary` | `<Button variant="outline">` |
   | `btn btn-ghost` | `<Button variant="ghost">` (of `link`) |
   | `btn-block` | `className="w-full"` |
   | `card` (+ `card-kicker/title/body/meta`) | `<SectionCard title description>` of `Card`-onderdelen; kicker → `meta`/Badge, geen uppercase |
   | `tag tag-accent` / `tag-neutral` / `tag-outline` | `<Badge variant="soft">` / `"muted"` / `"outline"` |
   | `field` + `label` + `input` | `<Label>` + `<Input>` (of `Form*` met zod) in `grid gap-2` |
   | `<select className="input">` | shadcn `Select` (of native select met Input-klassen als e2e `selectOption` gebruikt) |
   | `table` | `Table` (≥ md) / lijst-rijen (mobiel) |
   | `hr` | `<Separator />` of gewoon `gap` |
   | `text-muted` | `text-muted-foreground` |
   | inline `style={{ color: "var(--color-…)" }}` | utility (`text-primary`, `text-muted-foreground`, …) |
   | `fontFamily: "var(--font-heading)"` | `font-display` / `font-score` |

4. **Toestanden**: laden → skeleton, leeg → `EmptyState`, fout → `role="alert"`-blok, succes → `toast.success`.
5. **e2e-contract bewaren** (`tests/e2e/*.spec.ts`): exacte teksten die met `getByText`/`getByRole` gezocht worden (o.a. "Vorm een duo", "Challenges bekijken", "Ratinggeschiedenis", "Beschikbaarheid", "Uitdaging verstuurd", statuslabels "Geaccepteerd", "Wacht op bevestiging", "Voltooid", "Betwist", "(jouw duo)"), selectors `table tbody tr` en `tr[data-own="true"]` op `/ladder`, `section` rond duo-kaarten op `/dashboard`, `input[type=email|password|text]`, `button[type="submit"]`, knop "Dinsdag Avond" → tekst "Beschikbaar". Wil je een structuur wijzigen waar een test op leunt: pas de test in dezelfde wijziging aan en draai `npm run test:e2e`.
6. **Check**: `npx tsc --noEmit`, `npm run lint`, 390×844 en 1280×800, licht + donker, toetsenbordnavigatie (focus zichtbaar), reduced motion.
7. Laatste pagina gemigreerd? Verwijder `src/styles/legacy.css` + import, en vereenvoudig de dark-selector (§2).

---

## 9. Techniek & valkuilen

- **Tailwind v4**: config staat in CSS (`@theme inline` in `globals.css`); PostCSS-plugin `@tailwindcss/postcss`. Laagvolgorde `theme, base, legacy, components, utilities`.
- **shadcn CLI** (`npx shadcn@4.21.0 add …`, registries `@kokonutui` en `@bklit` staan in `components.json`):
  - Zet `from "cn"` om naar `from "@/lib/utils"` als de CLI dat npm-pakket `cn` installeert (bekende CLI-eigenaardigheid) en verwijder het pakket.
  - Bklit-items **injecteren kapotte CSS** (`var(----chart-1)`, eigen `.dark`-blok) in `globals.css` — draai daarna `git diff src/app/globals.css` en verwijder de injectie; de chart-tokens staan al in `:root`.
  - Beantwoord overwrite-vragen met **nee** (de lokale `button.tsx` e.d. zijn aangepast).
  - Nieuwe shadcn-componenten: omzetten naar `React.forwardRef` (React 18 geeft `ref` niet als prop door) en kleuren naar tokens.
- **React 18 / Next 14**: geen `use()`, geen ref-als-prop, geen `<Context value>`; `RefObject<T>` i.p.v. `RefObject<T | null>`. Alle toegevoegde packages hebben React 18 in hun peer-range.
- Zware client-onderdelen (charts) altijd via `next/dynamic` + skeleton.
- Pure logica (formatters, series) in `.ts`-bestanden met unit tests (`tests/unit/ui`).
