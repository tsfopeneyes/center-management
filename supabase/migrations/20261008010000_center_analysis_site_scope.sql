-- Analysis-only derived columns. No source rows, collection flows, or grants
-- change. CREATE OR REPLACE retains existing owners and privileges.
BEGIN;
CREATE OR REPLACE VIEW center_integration.analysis_locations WITH (security_barrier=true) AS
SELECT id, CASE
    WHEN id = 'ENOUGH_PLACE' OR name = '이높플레이스' THEN 'ENOUGH_PLACE'
    WHEN id = '2F 스퀘어' OR name = '하이픈' THEN 'HAIFN'
    ELSE NULL END::text AS site
FROM public.locations;

CREATE OR REPLACE VIEW center_integration.analysis_notices WITH (security_barrier=true) AS
SELECT id, category, program_date, created_at, program_status, is_recruiting,
    CASE
    WHEN program_location ~* '(하이픈|haifn)' AND program_location !~* '(이높|enough)' THEN 'HAIFN'
    WHEN program_location ~* '(이높|enough)' AND program_location !~* '(하이픈|haifn)' THEN 'ENOUGH_PLACE'
    ELSE NULL END::text AS site
FROM public.notices;

CREATE OR REPLACE VIEW center_integration.analysis_rental_bookings WITH (security_barrier=true) AS
SELECT b.id, b.booking_date, b.status,
    CASE s.region WHEN '강동' THEN 'HAIFN' WHEN '강서' THEN 'ENOUGH_PLACE' ELSE NULL END::text AS site
FROM public.rental_bookings b
LEFT JOIN public.rentals r ON r.id=b.rental_id
LEFT JOIN public.schools s ON s.id=r.school_id;

CREATE OR REPLACE VIEW center_integration.analysis_checkin_surveys WITH (security_barrier=true) AS
SELECT c.id, c.created_at, c.survey_type, l.site
FROM public.checkin_surveys c
LEFT JOIN center_integration.analysis_locations l ON l.id=c.location_id
WHERE c.aggregation_excluded IS NOT TRUE;
DO $$
DECLARE view_name text;
BEGIN
    IF (SELECT count(*) FROM center_integration.analysis_locations) <> (SELECT count(*) FROM public.locations)
       OR (SELECT count(*) FROM center_integration.analysis_notices) <> (SELECT count(*) FROM public.notices)
       OR (SELECT count(*) FROM center_integration.analysis_rental_bookings) <> (SELECT count(*) FROM public.rental_bookings)
       OR (SELECT count(*) FROM center_integration.analysis_checkin_surveys) <> (SELECT count(*) FROM public.checkin_surveys WHERE aggregation_excluded IS NOT TRUE) THEN
        RAISE EXCEPTION 'Site projection changed source cardinality';
    END IF;
    FOREACH view_name IN ARRAY ARRAY['analysis_locations','analysis_notices','analysis_rental_bookings','analysis_checkin_surveys'] LOOP
        IF NOT has_table_privilege('center_integration_reader','center_integration.' || view_name,'SELECT')
           OR has_table_privilege('anon','center_integration.' || view_name,'SELECT')
           OR has_table_privilege('authenticated','center_integration.' || view_name,'SELECT')
           OR has_table_privilege('center_integration_token','center_integration.' || view_name,'SELECT') THEN
            RAISE EXCEPTION 'Unexpected site projection privilege';
        END IF;
    END LOOP;
END $$;
COMMIT;
