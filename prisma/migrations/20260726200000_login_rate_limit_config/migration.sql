-- Data-migratie (geen schemawijziging): twee nieuwe platform_config-rijen
-- voor de rate limiting op het login-endpoint (US-A3). Conform CLAUDE.md
-- staat dit tunable parameter in platform_config, nooit hardcoded.
INSERT INTO "platform_config" (key, value, description) VALUES
    ('login_max_attempts', '5', 'Maximum aantal mislukte inlogpogingen voordat rate limiting wordt toegepast'),
    ('login_lockout_minutes', '15', 'Duur in minuten van de rate-limit lockout na te veel mislukte inlogpogingen')
ON CONFLICT (key) DO NOTHING;
