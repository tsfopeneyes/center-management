-- Recovery for 20260914050000_enable_core_realtime_updates.sql.
-- Use only if Realtime publication load must be rolled back after deployment.
DO $$
DECLARE
    target_table text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'users',
        'logs',
        'notices',
        'notice_responses',
        'checkin_surveys',
        'visit_notes'
    ]
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = target_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', target_table);
        END IF;
    END LOOP;
END
$$;
