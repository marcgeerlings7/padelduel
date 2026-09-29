-- Config-rijen voor ELO-gamesaldo en inactief-markering (KNLTB-aanvullingen,
-- akkoord PO 2026-09-28). De code valt terug op dezelfde defaults via
-- getConfigNumberOrDefault zolang deze rijen ontbreken.
INSERT INTO "platform_config" (key, value, description) VALUES
  ('elo_margin_multiplier_min', '0.75', 'ELO-gamesaldo: K-multiplier bij de kleinste marge (m = 0); moet > 0 zijn'),
  ('elo_margin_multiplier_max', '1.5', 'ELO-gamesaldo: K-multiplier bij de grootste marge (m = 1, bijv. 6-0 6-0); moet >= min zijn'),
  ('inactive_after_days', '60', 'Dagen zonder eigen activiteit waarna een duo als inactief wordt gemarkeerd')
ON CONFLICT (key) DO NOTHING;
