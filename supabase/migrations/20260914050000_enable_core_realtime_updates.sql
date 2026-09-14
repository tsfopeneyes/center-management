-- The web app already consumes row-level changes for these tables. Publishing
-- them replaces per-browser polling and keeps profile images synchronized.
-- This changes logical replication membership only; it does not alter or
-- delete application rows.
DO $$
DECLARE
    target_table text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        RAISE EXCEPTION 'supabase_realtime publication is missing';
    END IF;

    FOREACH target_table IN ARRAY ARRAY[
        'users',
        'logs',
        'notices',
        'notice_responses',
        'checkin_surveys',
        'visit_notes'
    ]
    LOOP
        IF to_regclass(format('public.%I', target_table)) IS NULL THEN
            RAISE EXCEPTION 'Required realtime table public.% is missing', target_table;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = target_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
        END IF;
    END LOOP;
END
$$;
