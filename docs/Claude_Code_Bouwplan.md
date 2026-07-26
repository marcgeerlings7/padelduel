# Bouwplan: Padel Ladder App bouwen met Claude Code

Dit plan beschrijft hoe je de documenten die we hebben opgesteld (PRD, ELO-algoritme, ER-diagram, databaseschema, sprint 1 user stories) daadwerkelijk laat uitvoeren door Claude Code, op een manier die past bij hoe een agentic coding tool het beste werkt: kleine, verifieerbare stappen met veel context vooraf, in plaats van "bouw de hele app in één keer".

---

## 1. Uitgangspunt

Claude Code werkt het best wanneer:
- Het **project-context** (PRD, schema, conventies) al in de repo staat vóórdat je begint te coderen, zodat elke sessie ernaar kan verwijzen.
- Je in **kleine, afgebakende taken** werkt (één epic/story per keer), niet "bouw de hele backend".
- Je **test-driven** werkt waar mogelijk: eerst laten schrijven wat "goed" betekent (tests/acceptatiecriteria), dan pas laten implementeren.
- Je **tussentijds reviewt** (diffs, plan mode) in plaats van blind te accepteren.

## 2. Aanbevolen techstack (met motivatie)

| Laag | Keuze | Motivatie |
|---|---|---|
| Frontend | Next.js (React) + TypeScript | SSR/CSR hybride, goede mobile-first ondersteuning, groot ecosysteem, sluit aan bij "moderne SPA"-eis uit PRD |
| Styling | Tailwind CSS | Snel, consistent, goed te combineren met component-libraries |
| Backend | Next.js API routes (of losse Node/Express service als je backend apart wilt schalen) | Eén taal/stack voor front- en backend versnelt Sprint 1 aanzienlijk; makkelijk later te ontkoppelen |
| ORM | Prisma | Type-safe queries, goede migratie-tooling, sluit direct aan op het SQL-schema dat we al hebben |
| Database | PostgreSQL | Al vastgelegd in PRD §7 (relationeel, transacties) |
| Auth | JWT (access + refresh token) via bijv. `jose` of `next-auth` (Credentials provider) | Stateless, schaalbaar, past bij rolgebaseerde toegang (user/admin) |
| Testing | Vitest/Jest (unit) + Playwright (e2e) | Unit tests essentieel voor het ELO-algoritme; e2e voor de challenge/match-flows |
| Hosting | Vercel (frontend/API) + managed Postgres (bijv. Neon/Supabase/RDS) | Cloud-ready, snel te droppen op iets simpelers voor de pilot |

> Deze stack is een aanbeveling, geen harde eis — als je team al een voorkeur heeft (bijv. NestJS backend, losse React SPA), is dat prima; het bouwplan hieronder blijft grotendeels hetzelfde qua volgorde en werkwijze.

## 3. Projectstructuur (voorstel)

```
padel-ladder/
├── CLAUDE.md                      ← projectinstructies voor Claude Code (zie §4)
├── docs/
│   ├── PRD_Padel_Ladder_App.md
│   ├── ELO_Algoritme.md
│   ├── ER_Diagram.mermaid
│   ├── Database_Schema.sql
│   ├── Sprint1_User_Stories.md
│   ├── Sprint2_User_Stories.md
│   ├── Sprint3_User_Stories.md
│   ├── Sprint4_User_Stories.md
│   └── Sprint5_User_Stories.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/                       ← Next.js routes (pages + API)
│   ├── lib/
│   │   ├── elo/                   ← pure functies, geen DB-afhankelijkheid
│   │   ├── auth/
│   │   └── ladder/
│   ├── components/
│   └── server/
│       ├── services/               ← business-logica (duo, challenge, match)
│       └── repositories/           ← DB-toegang via Prisma
├── tests/
│   ├── unit/
│   └── e2e/
└── scripts/
    └── seed.ts
```

## 4. CLAUDE.md — wat erin moet

Maak dit bestand aan **voordat** je Claude Code taken laat uitvoeren. Dit is het bestand dat Claude Code automatisch leest als projectcontext. Dit bestand groeit mee: na Sprint 1 voeg je een sectie "Sprint 2 scope" toe, enzovoort.

## 5. Fasering — mapping naar sprints en concrete Claude Code-instructies

Werk **fase voor fase**. Start een nieuwe fase pas als de vorige werkt en getest is.

### Fase 0 — Project scaffolding
**Doel:** lege, werkende Next.js + Prisma + Postgres-opzet, met CLAUDE.md en /docs erin.
**Definition of done:** `npm run dev` werkt, lege homepage, Prisma verbindt met een lokale Postgres-container.

### Fase 1 — Database schema & migraties
**Doel:** Prisma-schema dat 1-op-1 overeenkomt met `docs/Database_Schema.sql`.
**Definition of done:** migratie draait zonder fouten, seed-script vult de dev-database met 1 regio, 20 users, 10 duo's.

### Fase 2 — Authenticatie (Epic A)
**Doel:** US-A1, US-A2, US-A3 volledig werkend, inclusief tests.
**Definition of done:** alle acceptatiecriteria van US-A1–A3 zijn afgedekt door tests; handmatige test van de flow werkt end-to-end.

### Fase 3 — Duo management (Epic B)
**Doel:** US-B1, US-B2, US-B3 werkend.
**Definition of done:** alle acceptatiecriteria van US-B1–B3 gedekt; test voor "gebruiker met max aantal duo's kan er geen extra vormen" én test voor "zelfde koppel kan geen 2e actief duo vormen" slagen beide.

### Fase 4 — Ladder & dashboard (Epic C)
**Doel:** US-C1, US-C2 werkend, inclusief UI.
**Definition of done:** ladder toont correcte volgorde en posities met de seed-data; eigen duo('s) zijn gemarkeerd; dashboard toont per duo 3 boven/3 onder; een testgebruiker met 2+ duo's ziet beide correct naast elkaar.

### Fase 5 — ELO-module (losstaand, voorbereidend op Sprint 2)
**Doel:** de pure ELO-logica uit `docs/ELO_Algoritme.md` implementeren en volledig unit-testen, nog **niet** gekoppeld aan matches (die komen in Sprint 2).
**Definition of done:** alle in §8 genoemde testgevallen slagen; module heeft geen enkele import van Prisma/DB-code.

### Fase 6 — Sprint 2: Challenge-engine met rank-tiers (Epic E)
**Doel:** US-E1 t/m US-E5 uit `docs/Sprint2_User_Stories.md` werkend.
**Definition of done:** zie het Sprint Review Protocol in §8 — pas na een expliciet akkoord van de PO ga je door naar Fase 7.

### Fase 7 — Sprint 3: Matches, ELO-verwerking & speelverplichting (Epic F)
**Doel:** US-F1 t/m US-F6 uit `docs/Sprint3_User_Stories.md` werkend.
**Definition of done:** zie het Sprint Review Protocol in §8.

### Fase 8 — Sprint 4: Disputes (Epic G)
**Doel:** US-G1 t/m US-G4 uit `docs/Sprint4_User_Stories.md` werkend.
**Definition of done:** zie het Sprint Review Protocol in §8.

### Fase 9 — Sprint 5: Beschikbaarheid & Externe API (Epic H)
**Doel:** US-H1 t/m US-H5 uit `docs/Sprint5_User_Stories.md` werkend.
**Definition of done:** zie het Sprint Review Protocol in §8. Na akkoord op deze sprint is de volledige v1-scope (Sprint 1–5) compleet en klaar voor de pilot-rollout uit PRD §13.

## 6. Werkwijze-tips voor tijdens het bouwen

- **Eén fase per sessie/branch.** Laat Claude Code niet meerdere epics tegelijk oppakken — de kans op inconsistenties neemt toe.
- **Gebruik plan-mode / laat eerst een planningsoverzicht genereren** voordat je "ga verder" zegt, zeker bij Fase 1 (schema) en Fase 5 (ELO).
- **Review elke migratie handmatig** voordat je hem op iets anders dan een lokale dev-database toepast.
- **Voeg na elke fase een korte samenvatting toe aan CLAUDE.md.**
- **Laat testen daadwerkelijk draaien**, vraag niet alleen om tests te schrijven.
- **Bewaak scope actief.**

## 7. Concrete eerste stap (samenvatting)

1. Maak een lege git-repo `padel-ladder`.
2. Kopieer alle documenten (PRD, ELO, ER-diagram, schema, Sprint1–5 user stories) naar `/docs`.
3. Schrijf `CLAUDE.md` zoals in §4.
4. Start Claude Code in de repo-root en geef de Fase 0-prompt.
5. Werk fase voor fase door §5, met tussentijdse review na elke fase, en het volledige protocol uit §8 na elke sprint (Fase 5, 6, 7, 8, 9).

## 8. Sprint Review, Test & Presentatie-protocol (verplicht na elke sprint)

Dit protocol geldt na **elke** sprint (Sprint 1 t/m 5, dus na Fase 5, 6, 7, 8 en 9). Claude Code mag nooit automatisch doorstromen naar de volgende sprint — jij geeft als PO expliciet groen licht.

### Stap 1 — Geautomatiseerd testen
Laat Claude Code de volledige testsuite (unit + relevante integratie-/e2e-tests) daadwerkelijk **draaien**, niet alleen schrijven, en het resultaat rapporteren. Een sprint wordt nooit als afgerond beschouwd bij falende tests.

### Stap 2 — Codereview
Vraag Claude Code om een beknopte samenvatting van de wijzigingen: welke bestanden/modules zijn geraakt, welke belangrijke ontwerpbeslissingen zijn genomen, en waar eventueel van de oorspronkelijke instructies is afgeweken (en waarom).

### Stap 3 — Demo/presentatie aan jou
Laat Claude Code (of doorloop zelf) de acceptatiecriteria van elke user story in die sprint, met concreet bewijs per criterium.

### Stap 4 — Expliciete go/no-go
Beoordeel de sprint-review. Bij akkoord: geef expliciet toestemming voor de volgende fase/sprint. Bij twijfel of een gemiste acceptatiecriterium: laat dat eerst oplossen binnen de huidige sprint.

Elk van de Sprint-documenten (`Sprint1_User_Stories.md` t/m `Sprint5_User_Stories.md`) bevat aan het einde al een sprint-specifieke checklist die dit protocol concreet maakt voor die sprint.
