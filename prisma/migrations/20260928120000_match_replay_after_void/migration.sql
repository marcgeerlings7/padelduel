-- Post-v1 (akkoord PO 2026-09-28): opnieuw spelen na een overturned
-- match-score-dispute.
--
-- Voorheen was match.challenge_id UNIQUE: één challenge had hooguit één
-- match, ook als die match `voided` was (resolved_overturned). Daardoor kon
-- er voor die challenge nooit meer een score worden ingediend (doodlopende
-- weg, zie docs/Technical_Debt.md "Na Sprint 4").
--
-- Nieuw: een challenge kan meerdere matches hebben, maar hooguit ÉÉN die
-- niet `voided` is (partial unique index, niet in Prisma-DSL uit te
-- drukken — zelfde aanpak als duo.member_pair_key). Voided matches blijven
-- als audit-spoor bestaan.

-- DropIndex
DROP INDEX "match_challenge_id_key";

-- CreateIndex (gewone index voor de FK-lookups challenge -> matches)
CREATE INDEX "idx_match_challenge" ON "match"("challenge_id");

-- Partial unique index: maximaal één niet-voided match per challenge.
CREATE UNIQUE INDEX "idx_match_challenge_not_voided" ON "match"("challenge_id") WHERE "status" <> 'voided';
