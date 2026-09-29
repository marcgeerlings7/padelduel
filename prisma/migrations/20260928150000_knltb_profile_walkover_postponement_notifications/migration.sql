-- KNLTB-aanvullingen (akkoord PO 2026-09-28, incl. schemawijzigingen):
--   1. spelersprofiel: app_user.display_name + zelf opgegeven knltb_level;
--      duo.category (heren/dames/gemengd), ook op duo_invitation;
--   2. startrating nieuw duo = gemiddelde van de andere actieve duo's van
--      beide spelers (alleen een config-key, geen kolom);
--   3. match.result_type (played/walkover/retired) + conceding_side +
--      played_score_raw (KNLTB CRP art. 35.4 / 52.3);
--   4. challenge_postponement: uitstel in onderling overleg;
--   5. notification_preference (opt-out per soort) + notification_log
--      (idempotente e-mailnotificaties).
-- Het Prisma-gegenereerde deel staat eerst; daarna de raw-SQL-onderdelen
-- die Prisma-DSL niet kan uitdrukken (CHECK-constraints, partial indexen)
-- en de platform_config-seedwaarden.

-- CreateEnum
CREATE TYPE "duo_category" AS ENUM ('heren', 'dames', 'gemengd');

-- CreateEnum
CREATE TYPE "match_result_type" AS ENUM ('played', 'walkover', 'retired');

-- CreateEnum
CREATE TYPE "match_side" AS ENUM ('challenger', 'challenged');

-- CreateEnum
CREATE TYPE "postponement_status" AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('challenge_received', 'challenge_response_reminder', 'match_deadline_reminder', 'score_submitted', 'auto_confirm_reminder', 'dispute_resolved', 'postponement_requested', 'postponement_answered');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "display_name" VARCHAR(40),
ADD COLUMN     "knltb_level" SMALLINT;

-- AlterTable
ALTER TABLE "duo" ADD COLUMN     "category" "duo_category";

-- AlterTable
ALTER TABLE "duo_invitation" ADD COLUMN     "category" "duo_category";

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "conceding_side" "match_side",
ADD COLUMN     "played_score_raw" VARCHAR(50),
ADD COLUMN     "result_type" "match_result_type" NOT NULL DEFAULT 'played';

-- CreateTable
CREATE TABLE "challenge_postponement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "requested_by_duo_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "requested_days" SMALLINT NOT NULL,
    "reason" VARCHAR(500),
    "status" "postponement_status" NOT NULL DEFAULT 'pending',
    "responded_by_user_id" UUID,
    "previous_match_deadline" TIMESTAMP(3),
    "new_match_deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "challenge_postponement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "user_id" UUID NOT NULL,
    "challenge_received" BOOLEAN NOT NULL DEFAULT true,
    "challenge_response_reminder" BOOLEAN NOT NULL DEFAULT true,
    "match_deadline_reminder" BOOLEAN NOT NULL DEFAULT true,
    "score_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "dispute_resolved" BOOLEAN NOT NULL DEFAULT true,
    "postponement" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "occurrence_key" VARCHAR(64) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_challenge_postponement_challenge_status" ON "challenge_postponement"("challenge_id", "status");

-- CreateIndex
CREATE INDEX "idx_notification_log_entity" ON "notification_log"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_notification_log_unique" ON "notification_log"("user_id", "type", "entity_id", "occurrence_key");

-- AddForeignKey
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "challenge_postponement_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "challenge_postponement_requested_by_duo_id_fkey" FOREIGN KEY ("requested_by_duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "challenge_postponement_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "challenge_postponement_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =========================================================
-- Raw SQL (niet uit te drukken in Prisma-schema-DSL)
-- =========================================================

-- Zelf opgegeven KNLTB-speelsterkte: 1 (sterkst) t/m 9.
ALTER TABLE "app_user" ADD CONSTRAINT "chk_app_user_knltb_level"
    CHECK ("knltb_level" IS NULL OR "knltb_level" BETWEEN 1 AND 9);

-- Weergavenaam: NULL = nog niet ingesteld (publieke fallback in de app),
-- maar nooit een lege/whitespace-string.
ALTER TABLE "app_user" ADD CONSTRAINT "chk_app_user_display_name_not_blank"
    CHECK ("display_name" IS NULL OR length(btrim("display_name")) >= 2);

-- Een gespeelde uitslag heeft geen opgevende kant; walkover/retired wel.
-- Alleen bij retired wordt de werkelijk gespeelde (onvolledige) stand bewaard.
ALTER TABLE "match" ADD CONSTRAINT "chk_match_result_type_fields" CHECK (
    ("result_type" = 'played'   AND "conceding_side" IS NULL     AND "played_score_raw" IS NULL) OR
    ("result_type" = 'walkover' AND "conceding_side" IS NOT NULL AND "played_score_raw" IS NULL) OR
    ("result_type" = 'retired'  AND "conceding_side" IS NOT NULL AND "played_score_raw" IS NOT NULL)
);

-- Uitstel: positief aantal dagen (het maximum komt uit platform_config en
-- wordt in de service-laag gecontroleerd, want dat is tunable).
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "chk_postponement_days_positive"
    CHECK ("requested_days" >= 1);

-- Bij acceptatie worden beide deadlines vastgelegd, en de nieuwe ligt later.
ALTER TABLE "challenge_postponement" ADD CONSTRAINT "chk_postponement_accepted_deadlines" CHECK (
    "status" <> 'accepted' OR (
        "previous_match_deadline" IS NOT NULL AND
        "new_match_deadline" IS NOT NULL AND
        "new_match_deadline" > "previous_match_deadline"
    )
);

-- Hooguit één openstaand uitstelverzoek per challenge.
CREATE UNIQUE INDEX "idx_challenge_postponement_one_pending"
    ON "challenge_postponement" ("challenge_id")
    WHERE "status" = 'pending';

-- Matches die op bevestiging wachten, op auto-confirm-deadline (gebruikt
-- door zowel de auto-confirm-job als de herinneringsjob). Pending/accepted
-- challenges op deadline hebben al partial indexen (init-migratie).
CREATE INDEX "idx_match_awaiting_auto_confirm"
    ON "match" ("auto_confirm_deadline")
    WHERE "status" = 'awaiting_confirmation';

-- =========================================================
-- platform_config: nieuwe tunable parameters
-- =========================================================
INSERT INTO "platform_config" (key, value, description) VALUES
    ('default_start_rating', '1200', 'Startrating voor een speler zonder andere actieve duo''s; een nieuw duo start op het gemiddelde van beide spelers (gemiddelde rating van hun andere actieve duo''s, of deze waarde)'),
    ('postponement_max_days', '7', 'Maximum aantal dagen waarmee de speeltermijn per uitstelverzoek (in onderling overleg) verlengd kan worden'),
    ('postponement_max_per_challenge', '1', 'Maximum aantal geaccepteerde uitstelverzoeken per challenge'),
    ('notification_response_deadline_lead_hours', '24', 'Uren vóór de reactietermijn van een challenge waarop de uitgedaagde een herinnering krijgt'),
    ('notification_match_deadline_lead_hours', '48', 'Uren vóór de speeltermijn waarop beide duo''s een herinnering krijgen als er nog geen score is'),
    ('notification_auto_confirm_lead_hours', '12', 'Uren vóór de automatische bevestiging van een score waarop de tegenpartij een herinnering krijgt')
ON CONFLICT (key) DO NOTHING;
