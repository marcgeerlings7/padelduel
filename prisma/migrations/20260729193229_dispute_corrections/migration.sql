-- DropIndex
DROP INDEX "idx_rating_history_duo_challenge";

-- CreateIndex
CREATE INDEX "idx_rating_history_duo_challenge" ON "rating_history"("duo_id", "challenge_id");

-- Data-migratie (geen schemawijziging): nieuwe platform_config-rij voor
-- de forfeit-disputetermijn (US-G2).
INSERT INTO "platform_config" (key, value, description) VALUES
    ('forfeit_dispute_window_days', '5', 'Dagen na een unplayed_timeout waarbinnen een forfeit-dispute geopend kan worden')
ON CONFLICT (key) DO NOTHING;
