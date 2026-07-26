-- Extension gebruikt door Database_Schema.sql (op PG13+ ingebouwd, maar
-- expliciet aangemaakt voor pariteit/portabiliteit met dat document).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "challenge_status" AS ENUM ('pending', 'accepted', 'expired', 'completed', 'declined', 'unplayed_timeout');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('awaiting_confirmation', 'completed', 'disputed', 'voided');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('open', 'resolved_upheld', 'resolved_overturned');

-- CreateEnum
CREATE TYPE "dispute_subject" AS ENUM ('match_score', 'forfeit');

-- CreateTable
CREATE TABLE "platform_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "region" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "region_id" UUID NOT NULL,
    "member_pair_key" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_rating" INTEGER NOT NULL DEFAULT 1200,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "dissolution_requested_at" TIMESTAMP(3),
    "dissolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "duo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duo_membership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "duo_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "duo_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenger_duo_id" UUID NOT NULL,
    "challenged_duo_id" UUID NOT NULL,
    "status" "challenge_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_deadline" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "match_deadline" TIMESTAMP(3),

    CONSTRAINT "challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "score_raw" VARCHAR(50) NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'awaiting_confirmation',
    "submitted_by" UUID NOT NULL,
    "confirmed_by" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "auto_confirm_deadline" TIMESTAMP(3) NOT NULL,
    "idempotency_key" VARCHAR(100),

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "duo_id" UUID NOT NULL,
    "match_id" UUID,
    "challenge_id" UUID,
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,
    "k_factor" INTEGER,
    "is_forfeit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID,
    "challenge_id" UUID,
    "subject" "dispute_subject" NOT NULL,
    "raised_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'open',
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duo_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "duo_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duo_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_client" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "api_key_hash" VARCHAR(255) NOT NULL,
    "region_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "performed_by" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "region_slug_key" ON "region"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "idx_app_user_email" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "idx_duo_region_active_rating" ON "duo"("region_id", "is_active", "current_rating" DESC);

-- CreateIndex
CREATE INDEX "idx_duo_membership_duo" ON "duo_membership"("duo_id");

-- CreateIndex
CREATE INDEX "idx_challenge_challenger_status" ON "challenge"("challenger_duo_id", "status");

-- CreateIndex
CREATE INDEX "idx_challenge_challenged_status" ON "challenge"("challenged_duo_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "match_challenge_id_key" ON "match"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_idempotency_key_key" ON "match"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_match_status" ON "match"("status");

-- CreateIndex
CREATE INDEX "idx_rating_history_duo" ON "rating_history"("duo_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_rating_history_duo_match" ON "rating_history"("duo_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_rating_history_duo_challenge" ON "rating_history"("duo_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_match_id_key" ON "dispute"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_challenge_id_key" ON "dispute"("challenge_id");

-- CreateIndex
CREATE INDEX "idx_dispute_status" ON "dispute"("status");

-- CreateIndex
CREATE INDEX "idx_duo_availability_duo" ON "duo_availability"("duo_id");

-- CreateIndex
CREATE INDEX "idx_duo_availability_day" ON "duo_availability"("day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "api_client_api_key_hash_key" ON "api_client"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_api_client_active" ON "api_client"("is_active");

-- CreateIndex
CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "duo" ADD CONSTRAINT "duo_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_membership" ADD CONSTRAINT "duo_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_membership" ADD CONSTRAINT "duo_membership_duo_id_fkey" FOREIGN KEY ("duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_challenger_duo_id_fkey" FOREIGN KEY ("challenger_duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_challenged_duo_id_fkey" FOREIGN KEY ("challenged_duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_duo_id_fkey" FOREIGN KEY ("duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duo_availability" ADD CONSTRAINT "duo_availability_duo_id_fkey" FOREIGN KEY ("duo_id") REFERENCES "duo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_client" ADD CONSTRAINT "api_client_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- Onderstaande secties komen 1-op-1 uit docs/Database_Schema.sql en
-- kunnen niet in Prisma-schema-DSL uitgedrukt worden: partial unique
-- index, partial performance-indexen, CHECK-constraints en de trigger
-- die max_active_duos_per_user afdwingt. Zie CLAUDE.md.
-- =========================================================

-- PlatformConfig startwaarden (PRD §14 / CLAUDE.md: alle tunable
-- parameters centraal in platform_config, nooit hardcoded).
INSERT INTO "platform_config" (key, value, description) VALUES
    ('rating_tier_size', '100', 'Breedte van een rating-tier in ELO-punten'),
    ('max_active_duos_per_user', '5', 'Maximum aantal actieve duo-lidmaatschappen per gebruiker (richtwaarde 3-5)'),
    ('challenge_response_deadline_days', '5', 'Dagen voordat een niet-beantwoorde challenge verloopt'),
    ('challenge_match_deadline_days', '14', 'Dagen na acceptatie waarbinnen de wedstrijd gespeeld moet zijn'),
    ('forfeit_rating_penalty', '10', 'Vaste rating-penalty (punten) bij expired of unplayed_timeout'),
    ('forfeit_cooldown_days', '3', 'Cooldown in dagen na een opgelegde forfeit-penalty'),
    ('duo_dissolution_cooldown_days', '7', 'Cooldown in dagen na duo-ontbinding voordat leden opnieuw kunnen combineren');

-- FR-2.3: hetzelfde koppel (member_pair_key) kan nooit twee keer
-- tegelijk een actief duo vormen. Moet een partial index zijn (WHERE
-- is_active = true) zodat een ontbonden duo geen blijvende claim op de
-- pair_key houdt (US-B1: een nieuw duo met dezelfde twee mensen mag na
-- ontbinding wél weer gevormd worden).
CREATE UNIQUE INDEX "idx_unique_active_pair"
    ON "duo" ("member_pair_key")
    WHERE "is_active" = true;

-- Performance-partial-indexen voor de achtergrondjobs (Sprint 2/3) die
-- verlopen challenges/deadlines opzoeken.
CREATE INDEX "idx_duo_membership_user_active" ON "duo_membership" ("user_id") WHERE "left_at" IS NULL;
CREATE INDEX "idx_challenge_pending_deadline" ON "challenge" ("response_deadline") WHERE "status" = 'pending';
CREATE INDEX "idx_challenge_accepted_deadline" ON "challenge" ("match_deadline") WHERE "status" = 'accepted';

-- CHECK-constraints (niet uit te drukken in Prisma-schema-DSL 5.x)
ALTER TABLE "challenge" ADD CONSTRAINT "chk_challenge_not_self" CHECK ("challenger_duo_id" <> "challenged_duo_id");

ALTER TABLE "rating_history" ADD CONSTRAINT "chk_rating_history_source" CHECK (
    ("match_id" IS NOT NULL AND "challenge_id" IS NULL) OR
    ("match_id" IS NULL AND "challenge_id" IS NOT NULL)
);

ALTER TABLE "dispute" ADD CONSTRAINT "chk_dispute_source" CHECK (
    ("match_id" IS NOT NULL AND "challenge_id" IS NULL) OR
    ("match_id" IS NULL AND "challenge_id" IS NOT NULL)
);

ALTER TABLE "duo_availability" ADD CONSTRAINT "chk_availability_time_order" CHECK ("end_time" > "start_time");
ALTER TABLE "duo_availability" ADD CONSTRAINT "chk_availability_day_range" CHECK ("day_of_week" BETWEEN 0 AND 6);

-- Trigger: handhaaft max_active_duos_per_user (FR-1.4 / FR-2.5) als
-- laatste vangnet op databaseniveau, naast de check in de service-laag
-- die de gebruiker vóóraf een nette foutmelding moet geven.
CREATE OR REPLACE FUNCTION enforce_max_active_duos()
RETURNS TRIGGER AS $$
DECLARE
    max_allowed INTEGER;
    current_count INTEGER;
BEGIN
    IF NEW.left_at IS NULL THEN
        SELECT value::int INTO max_allowed
        FROM platform_config WHERE key = 'max_active_duos_per_user';

        SELECT count(*) INTO current_count
        FROM duo_membership
        WHERE user_id = NEW.user_id AND left_at IS NULL;

        IF current_count >= max_allowed THEN
            RAISE EXCEPTION 'Gebruiker % heeft al het maximum van % actieve duo''s bereikt', NEW.user_id, max_allowed;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_max_active_duos
    BEFORE INSERT ON duo_membership
    FOR EACH ROW EXECUTE FUNCTION enforce_max_active_duos();
