BEGIN;
CREATE TABLE center_integration.operating_context (
  domain text NOT NULL CHECK (domain = 'feedback'),
  start_day date NOT NULL,
  end_exclusive date NOT NULL CHECK (end_exclusive > start_day),
  activity_status text NOT NULL CHECK (activity_status IN ('not_conducted','conducted')),
  evidence text NOT NULL CHECK (evidence = 'operator_report'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain,start_day,end_exclusive)
);
REVOKE ALL ON center_integration.operating_context FROM PUBLIC,anon,authenticated,center_integration_token;
GRANT SELECT ON center_integration.operating_context TO center_integration_reader;
-- User confirmed non-conduct of satisfaction surveys for this analysis period.
INSERT INTO center_integration.operating_context VALUES
 ('feedback','2026-09-07','2026-10-07','not_conducted','operator_report',now());
COMMIT;
