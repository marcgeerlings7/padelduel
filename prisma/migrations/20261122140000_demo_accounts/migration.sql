-- Demo-accounts op productie (verzoek PO 2026-11-22). Vijf geactiveerde
-- spelers (demo1..demo5@example.com, wachtwoord in de PO-overdracht, NIET admin)
-- met vijf duo's in een aparte regio "Demo", zodat de echte ladder en ratings
-- niet vervuild raken. Alle duo's ongespeeld (plaatsingsperiode). E-mail-
-- notificaties staan uit (example.com is een gereserveerd domein).
-- Idempotent: bestaande rijen (zelfde id of e-mailadres) blijven ongemoeid.
-- Verwijderen kan later met een nieuwe migratie op deze vaste id's.

INSERT INTO "region" (id, name, slug) VALUES ('d0000000-0000-4000-8000-000000000001', 'Demo', 'demo')
ON CONFLICT DO NOTHING;

INSERT INTO "app_user" (id, email, password_hash, role, is_active, activated_at, display_name, knltb_level) VALUES
  ('d0000000-0000-4000-8000-100000000001', 'demo1@example.com', '$2b$10$QUvpF4DebsxOY0jfq8MtPeCa/66tjrSw36OuNCMJIM5Vu0dSOIYpO', 'user', true, CURRENT_TIMESTAMP, 'Demo Sanne', 3),
  ('d0000000-0000-4000-8000-100000000002', 'demo2@example.com', '$2b$10$QUvpF4DebsxOY0jfq8MtPeCa/66tjrSw36OuNCMJIM5Vu0dSOIYpO', 'user', true, CURRENT_TIMESTAMP, 'Demo Joris', 5),
  ('d0000000-0000-4000-8000-100000000003', 'demo3@example.com', '$2b$10$QUvpF4DebsxOY0jfq8MtPeCa/66tjrSw36OuNCMJIM5Vu0dSOIYpO', 'user', true, CURRENT_TIMESTAMP, 'Demo Fleur', NULL),
  ('d0000000-0000-4000-8000-100000000004', 'demo4@example.com', '$2b$10$QUvpF4DebsxOY0jfq8MtPeCa/66tjrSw36OuNCMJIM5Vu0dSOIYpO', 'user', true, CURRENT_TIMESTAMP, 'Demo Tim', 7),
  ('d0000000-0000-4000-8000-100000000005', 'demo5@example.com', '$2b$10$QUvpF4DebsxOY0jfq8MtPeCa/66tjrSw36OuNCMJIM5Vu0dSOIYpO', 'user', true, CURRENT_TIMESTAMP, 'Demo Noor', 2)
ON CONFLICT DO NOTHING;

INSERT INTO "notification_preference" (user_id, challenge_received, challenge_response_reminder, match_deadline_reminder, score_confirmation, dispute_resolved, postponement)
SELECT id, false, false, false, false, false, false FROM "app_user"
WHERE id IN ('d0000000-0000-4000-8000-100000000001', 'd0000000-0000-4000-8000-100000000002', 'd0000000-0000-4000-8000-100000000003', 'd0000000-0000-4000-8000-100000000004', 'd0000000-0000-4000-8000-100000000005')
ON CONFLICT DO NOTHING;

-- Alleen als de demoregio bestaat; lidmaatschappen hieronder alleen voor de echte demo-accounts.
INSERT INTO "duo" (id, name, region_id, member_pair_key, is_active, current_rating, matches_played)
SELECT v.id::uuid, v.name, v.region_id::uuid, v.member_pair_key, v.is_active, v.current_rating, v.matches_played FROM (VALUES
  ('d0000000-0000-4000-8000-200000000001', 'Demo Smashers', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-100000000001::d0000000-0000-4000-8000-100000000002', true, 1340, 0),
  ('d0000000-0000-4000-8000-200000000002', 'Demo Netrovers', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-100000000003::d0000000-0000-4000-8000-100000000004', true, 1310, 0),
  ('d0000000-0000-4000-8000-200000000003', 'Demo Bandejas', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-100000000001::d0000000-0000-4000-8000-100000000005', true, 1250, 0),
  ('d0000000-0000-4000-8000-200000000004', 'Demo Viboras', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-100000000002::d0000000-0000-4000-8000-100000000003', true, 1205, 0),
  ('d0000000-0000-4000-8000-200000000005', 'Demo Chiquitas', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-100000000004::d0000000-0000-4000-8000-100000000005', true, 1450, 0)
) AS v(id, name, region_id, member_pair_key, is_active, current_rating, matches_played)
WHERE EXISTS (SELECT 1 FROM "region" WHERE id = 'd0000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO "duo_membership" (user_id, duo_id)
SELECT v.user_id, v.duo_id FROM (VALUES
  ('d0000000-0000-4000-8000-100000000001'::uuid, 'd0000000-0000-4000-8000-200000000001'::uuid),
  ('d0000000-0000-4000-8000-100000000002'::uuid, 'd0000000-0000-4000-8000-200000000001'::uuid),
  ('d0000000-0000-4000-8000-100000000003'::uuid, 'd0000000-0000-4000-8000-200000000002'::uuid),
  ('d0000000-0000-4000-8000-100000000004'::uuid, 'd0000000-0000-4000-8000-200000000002'::uuid),
  ('d0000000-0000-4000-8000-100000000001'::uuid, 'd0000000-0000-4000-8000-200000000003'::uuid),
  ('d0000000-0000-4000-8000-100000000005'::uuid, 'd0000000-0000-4000-8000-200000000003'::uuid),
  ('d0000000-0000-4000-8000-100000000002'::uuid, 'd0000000-0000-4000-8000-200000000004'::uuid),
  ('d0000000-0000-4000-8000-100000000003'::uuid, 'd0000000-0000-4000-8000-200000000004'::uuid),
  ('d0000000-0000-4000-8000-100000000004'::uuid, 'd0000000-0000-4000-8000-200000000005'::uuid),
  ('d0000000-0000-4000-8000-100000000005'::uuid, 'd0000000-0000-4000-8000-200000000005'::uuid)
) AS v(user_id, duo_id)
WHERE EXISTS (SELECT 1 FROM "duo" WHERE id = v.duo_id)
  AND EXISTS (SELECT 1 FROM "app_user" WHERE id = v.user_id AND email LIKE 'demo_@example.com')
  AND NOT EXISTS (SELECT 1 FROM "duo_membership" m WHERE m.user_id = v.user_id AND m.duo_id = v.duo_id);
