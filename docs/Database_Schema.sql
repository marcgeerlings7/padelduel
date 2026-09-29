-- =========================================================
-- Padel Ladder Platform — Database Schema (PostgreSQL)
-- v1.1 — bijgewerkt: multi-duo lidmaatschap, rating-tiers,
-- forfeit-afhandeling, beschikbaarheid + externe API-clients.
-- Correspondeert met PRD v1.1 en ER_Diagram.mermaid
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- voor gen_random_uuid()

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE challenge_status AS ENUM (
    'pending', 'accepted', 'expired', 'completed', 'declined', 'unplayed_timeout'
);
CREATE TYPE match_status AS ENUM ('awaiting_confirmation', 'completed', 'disputed', 'voided');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved_upheld', 'resolved_overturned');
CREATE TYPE dispute_subject AS ENUM ('match_score', 'forfeit'); -- forfeit = unplayed_timeout of no-response
-- KNLTB-aanvullingen (akkoord PO 2026-09-28), migratie
-- 20260928150000_knltb_profile_walkover_postponement_notifications:
CREATE TYPE duo_category AS ENUM ('heren', 'dames', 'gemengd');          -- speltype (informatief)
CREATE TYPE match_result_type AS ENUM ('played', 'walkover', 'retired'); -- KNLTB CRP art. 35.4 / 52.3
CREATE TYPE match_side AS ENUM ('challenger', 'challenged');
CREATE TYPE postponement_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');
CREATE TYPE notification_type AS ENUM (
    'challenge_received', 'challenge_response_reminder', 'match_deadline_reminder',
    'score_submitted', 'auto_confirm_reminder', 'dispute_resolved',
    'postponement_requested', 'postponement_answered'
);

-- ---------------------------------------------------------
-- PLATFORM CONFIG
-- Centrale plek voor de tunable business-parameters uit het PRD
-- (open vragen §14). Eén rij per key, applicatielaag leest/cachet dit.
-- ---------------------------------------------------------
CREATE TABLE platform_config (
    key             VARCHAR(100) PRIMARY KEY,
    value           VARCHAR(255) NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aanbevolen startwaarden (aan te passen zonder deploy):
INSERT INTO platform_config (key, value, description) VALUES
    ('rating_tier_size', '100', 'Breedte van een rating-tier in ELO-punten'),
    ('max_active_duos_per_user', '5', 'Maximum aantal actieve duo-lidmaatschappen per gebruiker (richtwaarde 3-5)'),
    ('challenge_response_deadline_days', '5', 'Dagen voordat een niet-beantwoorde challenge verloopt'),
    ('challenge_match_deadline_days', '14', 'Dagen na acceptatie waarbinnen de wedstrijd gespeeld moet zijn'),
    ('forfeit_rating_penalty', '10', 'Vaste rating-penalty (punten) bij expired of unplayed_timeout'),
    ('forfeit_cooldown_days', '3', 'Cooldown in dagen na een opgelegde forfeit-penalty'),
    ('duo_dissolution_cooldown_days', '7', 'Cooldown in dagen na duo-ontbinding voordat leden opnieuw kunnen combineren');
-- (Latere migraties voegen o.a. login-, match-, dispute- en API-parameters toe.)
-- KNLTB-aanvullingen:
INSERT INTO platform_config (key, value, description) VALUES
    ('default_start_rating', '1200', 'Startrating voor een speler zonder andere actieve duo''s (nieuw duo = gemiddelde van beide spelers)'),
    ('postponement_max_days', '7', 'Maximum aantal dagen uitstel per verzoek (in onderling overleg)'),
    ('postponement_max_per_challenge', '1', 'Maximum aantal geaccepteerde uitstelverzoeken per challenge'),
    ('notification_response_deadline_lead_hours', '24', 'Herinnering reactietermijn: uren vooraf'),
    ('notification_match_deadline_lead_hours', '48', 'Herinnering speeltermijn: uren vooraf'),
    ('notification_auto_confirm_lead_hours', '12', 'Herinnering automatische scorebevestiging: uren vooraf');

-- ---------------------------------------------------------
-- REGION
-- ---------------------------------------------------------
CREATE TABLE region (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- USER
-- ---------------------------------------------------------
CREATE TABLE app_user (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT false,
    activated_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- KNLTB-aanvullingen: publieke weergavenaam (NULL = nog niet ingesteld;
    -- de app toont dan een neutrale fallback, NOOIT het e-mailadres) en
    -- zelf opgegeven KNLTB-speelsterkte. Bewust GEEN KNLTB-bondsnummer.
    display_name    VARCHAR(40),
    knltb_level     SMALLINT,
    CONSTRAINT chk_app_user_knltb_level CHECK (knltb_level IS NULL OR knltb_level BETWEEN 1 AND 9),
    CONSTRAINT chk_app_user_display_name_not_blank CHECK (display_name IS NULL OR length(btrim(display_name)) >= 2)
);

CREATE INDEX idx_app_user_email ON app_user (email);

-- ---------------------------------------------------------
-- DUO
-- member_pair_key = gesorteerde concatenatie van de twee user-id's,
-- bijv. 'uuid-a::uuid-b' met uuid-a < uuid-b. Wordt door de
-- applicatielaag gezet bij aanmaak en gebruikt om te voorkomen dat
-- hetzelfde koppel twee keer tegelijk een actief duo vormt.
-- ---------------------------------------------------------
CREATE TABLE duo (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(100) NOT NULL,
    region_id                   UUID NOT NULL REFERENCES region(id),
    member_pair_key             VARCHAR(150) NOT NULL,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    current_rating              INTEGER NOT NULL DEFAULT 1200,
    matches_played              INTEGER NOT NULL DEFAULT 0,
    dissolution_requested_at    TIMESTAMPTZ,
    dissolved_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                     INTEGER NOT NULL DEFAULT 0,
    -- KNLTB-aanvullingen: speltype, informatief (geen invloed op uitdaagregels).
    -- Ook op duo_invitation.category (wordt bij acceptatie overgenomen).
    -- current_rating wordt bij aanmaak door de service gezet op het gemiddelde
    -- van beide spelers (ELO_Algoritme.md §4); de DEFAULT is alleen een vangnet.
    category                    duo_category
);

CREATE INDEX idx_duo_region_active_rating ON duo (region_id, is_active, current_rating DESC);

-- Kern van FR-2.3: hetzelfde koppel kan niet twee keer tegelijk een
-- actief duo vormen.
CREATE UNIQUE INDEX idx_unique_active_pair
    ON duo (member_pair_key)
    WHERE is_active = true;

-- Rating-tier is bewust GEEN kolom: wordt berekend als
--   floor(current_rating / (SELECT value::int FROM platform_config WHERE key = 'rating_tier_size'))
-- analoog aan de afgeleide ladderpositie (FR-3.3 / FR-4.2).

-- ---------------------------------------------------------
-- DUO_MEMBERSHIP
-- Een user kan nu MEERDERE rijen met left_at IS NULL hebben
-- (multi-duo lidmaatschap, FR-1.4). Het maximum wordt afgedwongen
-- via de trigger hieronder, niet via een unique index.
-- ---------------------------------------------------------
CREATE TABLE duo_membership (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES app_user(id),
    duo_id      UUID NOT NULL REFERENCES duo(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ
);

CREATE INDEX idx_duo_membership_duo ON duo_membership (duo_id);
CREATE INDEX idx_duo_membership_user_active ON duo_membership (user_id) WHERE left_at IS NULL;

-- Trigger: handhaaft max_active_duos_per_user (FR-1.4 / FR-2.5) als
-- laatste vangnet op databaseniveau (naast de check in de service-laag,
-- die de gebruiker een nette foutmelding moet geven vóórdat dit raakt).
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

-- ---------------------------------------------------------
-- CHALLENGE
-- ---------------------------------------------------------
CREATE TABLE challenge (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_duo_id   UUID NOT NULL REFERENCES duo(id),
    challenged_duo_id   UUID NOT NULL REFERENCES duo(id),
    status              challenge_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    response_deadline   TIMESTAMPTZ NOT NULL,   -- created_at + challenge_response_deadline_days (FR-4.4)
    responded_at        TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    match_deadline       TIMESTAMPTZ,            -- accepted_at + challenge_match_deadline_days (FR-4.5)
    CONSTRAINT chk_challenge_not_self CHECK (challenger_duo_id <> challenged_duo_id)
);

-- FR-4.1: max 1 actieve challenge per duo — afgedwongen op applicatieniveau,
-- onderstaande indexen ondersteunen die check performant.
CREATE INDEX idx_challenge_challenger_status ON challenge (challenger_duo_id, status);
CREATE INDEX idx_challenge_challenged_status ON challenge (challenged_duo_id, status);
-- Ondersteunt de achtergrondjob die 'pending' -> 'expired' en
-- 'accepted' -> 'unplayed_timeout' zet zodra deadlines verstrijken.
CREATE INDEX idx_challenge_pending_deadline ON challenge (response_deadline) WHERE status = 'pending';
CREATE INDEX idx_challenge_accepted_deadline ON challenge (match_deadline) WHERE status = 'accepted';

-- FR-4.2: tier-restrictie (challenger.tier == challenged.tier) wordt
-- gevalideerd in de service-laag op het moment van aanmaken, met de
-- ratings van beide duo's op dat moment — niet als DB-constraint,
-- omdat ratings continu veranderen.

-- ---------------------------------------------------------
-- MATCH
-- ---------------------------------------------------------
CREATE TABLE match (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Post-v1 (akkoord PO 2026-09-28): niet meer UNIQUE — zie de partial
    -- unique index hieronder (replay na een voided match).
    challenge_id            UUID NOT NULL REFERENCES challenge(id),
    score_raw               VARCHAR(50) NOT NULL,
    status                  match_status NOT NULL DEFAULT 'awaiting_confirmation',
    submitted_by            UUID NOT NULL REFERENCES app_user(id),
    confirmed_by            UUID REFERENCES app_user(id),
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at            TIMESTAMPTZ,
    auto_confirm_deadline   TIMESTAMPTZ NOT NULL,
    idempotency_key         VARCHAR(100) UNIQUE,
    -- KNLTB-aanvullingen: bij walkover/retired is score_raw de VOLTOOIDE
    -- uitslag (grondslag voor ELO); conceding_side = kant die niet kwam /
    -- opgaf; played_score_raw = werkelijk gespeelde stand bij opgave.
    result_type             match_result_type NOT NULL DEFAULT 'played',
    conceding_side          match_side,
    played_score_raw        VARCHAR(50),
    CONSTRAINT chk_match_result_type_fields CHECK (
        (result_type = 'played'   AND conceding_side IS NULL     AND played_score_raw IS NULL) OR
        (result_type = 'walkover' AND conceding_side IS NOT NULL AND played_score_raw IS NULL) OR
        (result_type = 'retired'  AND conceding_side IS NOT NULL AND played_score_raw IS NOT NULL)
    )
);

CREATE INDEX idx_match_status ON match (status);
CREATE INDEX idx_match_challenge ON match (challenge_id);
-- Hooguit één niet-voided match per challenge; voided matches (overturned
-- dispute) blijven als audit-spoor staan en blokkeren een nieuwe poging niet.
CREATE UNIQUE INDEX idx_match_challenge_not_voided ON match (challenge_id) WHERE status <> 'voided';
CREATE INDEX idx_match_awaiting_auto_confirm ON match (auto_confirm_deadline) WHERE status = 'awaiting_confirmation';

-- ---------------------------------------------------------
-- CHALLENGE_POSTPONEMENT  (KNLTB-aanvullingen)
-- Uitstel van de speeltermijn in onderling overleg: één duo vraagt N dagen,
-- het andere duo accepteert of weigert. Alleen 'accepted' verschuift
-- challenge.match_deadline (nieuwe deadline = deadline bij acceptatie + N).
-- ---------------------------------------------------------
CREATE TABLE challenge_postponement (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id            UUID NOT NULL REFERENCES challenge(id),
    requested_by_duo_id     UUID NOT NULL REFERENCES duo(id),
    requested_by_user_id    UUID NOT NULL REFERENCES app_user(id),
    requested_days          SMALLINT NOT NULL CHECK (requested_days >= 1), -- max: platform_config.postponement_max_days
    reason                  VARCHAR(500),
    status                  postponement_status NOT NULL DEFAULT 'pending',
    responded_by_user_id    UUID REFERENCES app_user(id),
    previous_match_deadline TIMESTAMPTZ,   -- gezet bij acceptatie
    new_match_deadline      TIMESTAMPTZ,   -- gezet bij acceptatie
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at            TIMESTAMPTZ,
    CONSTRAINT chk_postponement_accepted_deadlines CHECK (
        status <> 'accepted' OR (
            previous_match_deadline IS NOT NULL AND new_match_deadline IS NOT NULL
            AND new_match_deadline > previous_match_deadline
        )
    )
);

CREATE INDEX idx_challenge_postponement_challenge_status ON challenge_postponement (challenge_id, status);
CREATE UNIQUE INDEX idx_challenge_postponement_one_pending ON challenge_postponement (challenge_id) WHERE status = 'pending';

-- ---------------------------------------------------------
-- RATING_HISTORY
-- is_forfeit onderscheidt een echte wedstrijduitslag van een vaste
-- forfeit-penalty (FR-6.5), zodat de UI dit apart kan tonen (FR-7.4).
-- ---------------------------------------------------------
CREATE TABLE rating_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duo_id          UUID NOT NULL REFERENCES duo(id),
    match_id        UUID REFERENCES match(id),
    challenge_id    UUID REFERENCES challenge(id),  -- gezet bij forfeit-penalty's zonder match
    rating_before   INTEGER NOT NULL,
    rating_after    INTEGER NOT NULL,
    k_factor        INTEGER,                         -- NULL bij forfeit (vaste penalty, geen K-factor)
    is_forfeit      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_rating_history_source CHECK (
        (match_id IS NOT NULL AND challenge_id IS NULL) OR
        (match_id IS NULL AND challenge_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX idx_rating_history_duo_match ON rating_history (duo_id, match_id) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX idx_rating_history_duo_challenge ON rating_history (duo_id, challenge_id) WHERE challenge_id IS NOT NULL;
CREATE INDEX idx_rating_history_duo ON rating_history (duo_id, created_at DESC);

-- ---------------------------------------------------------
-- DISPUTE
-- Kan gekoppeld zijn aan een Match (score-geschil) OF aan een
-- Challenge (forfeit-geschil bij unplayed_timeout), nooit beide.
-- ---------------------------------------------------------
CREATE TABLE dispute (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID REFERENCES match(id),
    challenge_id    UUID REFERENCES challenge(id),
    subject         dispute_subject NOT NULL,
    raised_by       UUID NOT NULL REFERENCES app_user(id),
    reason          TEXT NOT NULL,
    status          dispute_status NOT NULL DEFAULT 'open',
    resolved_by     UUID REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    CONSTRAINT chk_dispute_source CHECK (
        (match_id IS NOT NULL AND challenge_id IS NULL) OR
        (match_id IS NULL AND challenge_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX idx_dispute_unique_match ON dispute (match_id) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX idx_dispute_unique_challenge ON dispute (challenge_id) WHERE challenge_id IS NOT NULL;
CREATE INDEX idx_dispute_status ON dispute (status);

-- ---------------------------------------------------------
-- DUO_AVAILABILITY  (nieuw, FR-8.1/8.2)
-- ---------------------------------------------------------
CREATE TABLE duo_availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duo_id          UUID NOT NULL REFERENCES duo(id),
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = maandag
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    recurring       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_availability_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_duo_availability_duo ON duo_availability (duo_id);
CREATE INDEX idx_duo_availability_day ON duo_availability (day_of_week);

-- ---------------------------------------------------------
-- API_CLIENT  (nieuw, FR-8.3/8.6 — externe clubsystemen)
-- ---------------------------------------------------------
CREATE TABLE api_client (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    api_key_hash    VARCHAR(255) NOT NULL UNIQUE,
    region_id       UUID REFERENCES region(id),  -- NULL = toegang tot alle regio's (bijv. platform-brede partner)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_client_active ON api_client (is_active);

-- ---------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(50) NOT NULL,   -- o.a. 'score_submitted', 'forfeit_penalty_applied', 'dispute_resolved'
    performed_by    UUID REFERENCES app_user(id),
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);

-- ---------------------------------------------------------
-- NOTIFICATION_PREFERENCE / NOTIFICATION_LOG  (KNLTB-aanvullingen)
-- Opt-out per soort e-mail (geen rij = alles aan) en idempotentie: een
-- log-rij wordt vóór verzending geclaimd; occurrence_key onderscheidt
-- herhalingen (bijv. de deadline waarvoor een herinnering gold).
-- ---------------------------------------------------------
CREATE TABLE notification_preference (
    user_id                     UUID PRIMARY KEY REFERENCES app_user(id),
    challenge_received          BOOLEAN NOT NULL DEFAULT true,
    challenge_response_reminder BOOLEAN NOT NULL DEFAULT true,
    match_deadline_reminder     BOOLEAN NOT NULL DEFAULT true,
    score_confirmation          BOOLEAN NOT NULL DEFAULT true,
    dispute_resolved            BOOLEAN NOT NULL DEFAULT true,
    postponement                BOOLEAN NOT NULL DEFAULT true,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES app_user(id),
    type            notification_type NOT NULL,
    entity_id       UUID NOT NULL,          -- challenge / match / dispute / postponement
    occurrence_key  VARCHAR(64) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_notification_log_unique ON notification_log (user_id, type, entity_id, occurrence_key);
CREATE INDEX idx_notification_log_entity ON notification_log (entity_id);

-- =========================================================
-- Opmerkingen bij ontwerpkeuzes (v1.1)
-- =========================================================
-- 1. Multi-duo (FR-1.4): de vroegere partial unique index "1 actief
--    duo per user" is vervangen door een trigger die het aantal
--    actieve memberships telt tegen platform_config.max_active_duos_per_user.
--    Een trigger is hier bewust gekozen boven een simpele unique index,
--    omdat "maximum N" niet met een unique index af te dwingen is.
--
-- 2. member_pair_key (FR-2.3): voorkomt dat hetzelfde koppel twee
--    actieve duo's tegelijk vormt. Wordt door de service-laag
--    gegenereerd (sorteer user-id's, concateneer) vóór insert.
--
-- 3. Rating-tier blijft, net als ladderpositie, een AFGELEIDE waarde
--    (floor(rating / tier_size)) — geen kolom, om drift tussen rating
--    en tier te voorkomen wanneer tier_size later wijzigt.
--
-- 4. RatingHistory ondersteunt nu twee bronnen (match XOR challenge)
--    zodat forfeit-penalty's (geen match, wel impact op rating) even
--    goed herleidbaar zijn als echte wedstrijduitslagen.
--
-- 5. DUO_AVAILABILITY en API_CLIENT zijn losstaand van het
--    reserveringsproces zelf (dat blijft extern, zie PRD §4) — dit
--    platform registreert alleen "wanneer wil dit duo spelen",
--    niet "welke baan is geboekt".
