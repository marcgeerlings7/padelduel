-- Data-migratie (geen schemawijziging): rate-limit-parameter voor de
-- externe availability-API (US-H5, FR-8.6).
INSERT INTO "platform_config" (key, value, description) VALUES
    ('availability_api_rate_limit_per_minute', '60', 'Maximum aantal aanroepen per minuut per API-client op de externe availability-API')
ON CONFLICT (key) DO NOTHING;
