-- Startrating & plaatsing (akkoord PO 2026-11-22, zie docs/Advies_Startrating.md).
--
-- Laag C: admin-verificatie van de zelf opgegeven KNLTB-speelsterkte.
-- Er wordt bewust GEEN bondsnummer en GEEN schermafbeelding opgeslagen;
-- alleen of/wanneer/door wie de opgegeven speelsterkte is geverifieerd en
-- of de speler verificatie heeft aangevraagd. Een gewijzigde speelsterkte
-- wist de verificatie (service-laag).
ALTER TABLE "app_user"
  ADD COLUMN "knltb_level_verified_at" TIMESTAMP(3),
  ADD COLUMN "knltb_level_verified_by" UUID,
  ADD COLUMN "knltb_verification_requested_at" TIMESTAMP(3);

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_knltb_level_verified_by_fkey"
  FOREIGN KEY ("knltb_level_verified_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Openstaande aanvragen (admin-overzicht).
CREATE INDEX "idx_app_user_knltb_verification_requested"
  ON "app_user" ("knltb_verification_requested_at");

-- Config-rijen (lagen A, B, C). De code valt terug op dezelfde defaults via
-- getConfigNumberOrDefault zolang deze rijen ontbreken.
INSERT INTO "platform_config" (key, value, description) VALUES
  ('start_rating_level_step', '50', 'Startbonus per stap KNLTB-speelsterkte sterker dan 9 (alleen voor spelers zonder gespeelde duo''s); moet >= 0 zijn'),
  ('start_rating_unverified_max_bonus', '200', 'Maximale startbonus op basis van een NIET geverifieerde speelsterkte; moet >= 0 zijn'),
  ('start_rating_verified_max_bonus', '400', 'Maximale startbonus op basis van een door een admin geverifieerde speelsterkte; moet >= 0 zijn'),
  ('placement_max_matches', '10', 'Plaatsingsperiode: aantal gespeelde wedstrijden waarna een duo alleen nog binnen de eigen tier mag uitdagen'),
  ('placement_challenge_tiers_up', '2', 'Plaatsingsperiode: hoeveel tiers hoger een duo mag uitdagen (0 = uitgeschakeld)')
ON CONFLICT (key) DO NOTHING;
