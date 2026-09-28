---
name: sprint-review
description: Voer het verplichte Sprint Review-protocol uit (Claude_Code_Bouwplan.md §8) — volledige testrun, wijzigingssamenvatting, bewijs per acceptatiecriterium en go/no-go-vraag aan de PO. Gebruik bij "sprint afronden", "sprint review" of "is sprint N klaar".
---

# Sprint review (Bouwplan §8)

1. **Bepaal de sprint** uit het argument of uit de sprint-status in CLAUDE.md. Lees `docs/SprintN_User_Stories.md` inclusief de checklist aan het einde.
2. **Tests daadwerkelijk draaien** (niet alleen noemen):
   - `npm test` (unit, vitest)
   - `npm run test:e2e` (reset eerst de TESTdatabase op :3100 — raakt de dev-db op :3000 nooit)
   - `npx tsc --noEmit` en `npm run lint`
   Rapporteer aantallen geslaagd/gefaald met de relevante output. Bij falende tests: sprint is NIET af — meld dat en stop.
3. **Codereview-samenvatting**: `git log`/`git diff` sinds de vorige sprint-afronding. Welke modules geraakt, belangrijke ontwerpbeslissingen, en afwijkingen van CLAUDE.md-principes of Database_Schema.sql (met reden).
4. **Acceptatiecriteria**: tabel per user story → criterium → bewijs (testnaam, bestand:regel, of handmatige stap).
5. **Technical debt**: werk het blok "Na Sprint N" in `docs/Technical_Debt.md` bij.
6. **Stop en vraag expliciet go/no-go** aan de PO. Werk de sprint-status in CLAUDE.md pas bij ná akkoord, en begin nooit aan de volgende sprint.
