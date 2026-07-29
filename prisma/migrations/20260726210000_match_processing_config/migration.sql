-- Data-migratie (geen schemawijziging): twee nieuwe platform_config-rijen
-- voor matchverwerking (US-F1/US-F4, ELO_Algoritme.md §6.2).
INSERT INTO "platform_config" (key, value, description) VALUES
    ('match_auto_confirm_hours', '48', 'Uren voordat een ingediende score automatisch definitief wordt zonder bevestiging'),
    ('repeated_opponent_window_days', '14', 'Venster in dagen waarbinnen een herhaalde wedstrijd tussen dezelfde twee duo''s gedempt wordt (halve K-factor)')
ON CONFLICT (key) DO NOTHING;
