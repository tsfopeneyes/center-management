-- Required by the already-approved, single-admin activation.
-- Grants only the primary-key column used to select the singleton settings row.
BEGIN;
GRANT SELECT(singleton) ON center_integration.settings TO center_integration_reader;
COMMIT;
