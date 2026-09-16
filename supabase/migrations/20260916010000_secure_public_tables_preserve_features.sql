-- Secure the five tables reported by Supabase Advisor while preserving the
-- existing application flows. Review and dry-run before production apply.
BEGIN;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'duty_checklist_settings',
        'duty_logs',
        'global_settings',
        'haifn_items',
        'haifn_transactions'
    ] LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
            RAISE EXCEPTION 'Required table public.% is missing', table_name;
        END IF;
    END LOOP;

    IF to_regprocedure('public.is_current_staff()') IS NULL THEN
        RAISE EXCEPTION 'Required function public.is_current_staff() is missing';
    END IF;

    IF to_regprocedure('public.is_current_profile(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Required function public.is_current_profile(uuid) is missing';
    END IF;
END;
$$;

ALTER TABLE public.duty_checklist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_transactions ENABLE ROW LEVEL SECURITY;

-- Remove legacy client policies that allowed every operation. Worker-specific
-- account-merge policies on haifn_transactions are intentionally preserved.
DROP POLICY IF EXISTS "Enable all for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "관리자만 global_settings 수정 가능" ON public.global_settings;
DROP POLICY IF EXISTS "모든 사용자가 global_settings 조회 가능" ON public.global_settings;
DROP POLICY IF EXISTS authz_guard_staff_insert ON public.global_settings;
DROP POLICY IF EXISTS authz_guard_staff_update ON public.global_settings;
DROP POLICY IF EXISTS authz_guard_staff_delete ON public.global_settings;

DROP POLICY IF EXISTS "Allow manage for admin only" ON public.haifn_items;
DROP POLICY IF EXISTS "Allow public select for hyphen_items" ON public.haifn_items;

DROP POLICY IF EXISTS "Allow delete for admin only" ON public.haifn_transactions;
DROP POLICY IF EXISTS "Allow public insert for transactions" ON public.haifn_transactions;
DROP POLICY IF EXISTS "Allow select for self and admin" ON public.haifn_transactions;
DROP POLICY IF EXISTS "Enable all for hyphen_transactions" ON public.haifn_transactions;
DROP POLICY IF EXISTS authz_guard_owner_insert ON public.haifn_transactions;
DROP POLICY IF EXISTS authz_guard_owner_update ON public.haifn_transactions;
DROP POLICY IF EXISTS authz_guard_owner_delete ON public.haifn_transactions;

-- Duty screens are administrative. Authenticated staff keep full access.
DROP POLICY IF EXISTS duty_checklist_settings_staff_all ON public.duty_checklist_settings;
CREATE POLICY duty_checklist_settings_staff_all
ON public.duty_checklist_settings
FOR ALL TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS duty_logs_staff_all ON public.duty_logs;
CREATE POLICY duty_logs_staff_all
ON public.duty_logs
FOR ALL TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

-- The app reads global settings before sign-in; only staff may change them.
DROP POLICY IF EXISTS global_settings_public_read ON public.global_settings;
CREATE POLICY global_settings_public_read
ON public.global_settings
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS global_settings_staff_insert ON public.global_settings;
CREATE POLICY global_settings_staff_insert
ON public.global_settings
FOR INSERT TO authenticated
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS global_settings_staff_update ON public.global_settings;
CREATE POLICY global_settings_staff_update
ON public.global_settings
FOR UPDATE TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS global_settings_staff_delete ON public.global_settings;
CREATE POLICY global_settings_staff_delete
ON public.global_settings
FOR DELETE TO authenticated
USING (public.is_current_staff());

-- Store items remain visible to signed-out visitors and students. Inventory
-- management remains staff-only.
DROP POLICY IF EXISTS haifn_items_public_read ON public.haifn_items;
CREATE POLICY haifn_items_public_read
ON public.haifn_items
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS haifn_items_staff_insert ON public.haifn_items;
CREATE POLICY haifn_items_staff_insert
ON public.haifn_items
FOR INSERT TO authenticated
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS haifn_items_staff_update ON public.haifn_items;
CREATE POLICY haifn_items_staff_update
ON public.haifn_items
FOR UPDATE TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS haifn_items_staff_delete ON public.haifn_items;
CREATE POLICY haifn_items_staff_delete
ON public.haifn_items
FOR DELETE TO authenticated
USING (public.is_current_staff());

-- Students retain their existing history and reward/exchange creation flows.
-- Ledger mutation and deletion are restricted to staff.
DROP POLICY IF EXISTS haifn_transactions_owner_or_staff_read ON public.haifn_transactions;
CREATE POLICY haifn_transactions_owner_or_staff_read
ON public.haifn_transactions
FOR SELECT TO authenticated
USING (
    public.is_current_staff()
    OR public.is_current_profile(user_id)
);

DROP POLICY IF EXISTS haifn_transactions_owner_or_staff_insert ON public.haifn_transactions;
CREATE POLICY haifn_transactions_owner_or_staff_insert
ON public.haifn_transactions
FOR INSERT TO authenticated
WITH CHECK (
    public.is_current_staff()
    OR public.is_current_profile(user_id)
);

DROP POLICY IF EXISTS haifn_transactions_staff_update ON public.haifn_transactions;
CREATE POLICY haifn_transactions_staff_update
ON public.haifn_transactions
FOR UPDATE TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

DROP POLICY IF EXISTS haifn_transactions_staff_delete ON public.haifn_transactions;
CREATE POLICY haifn_transactions_staff_delete
ON public.haifn_transactions
FOR DELETE TO authenticated
USING (public.is_current_staff());

-- Align direct table privileges with the application paths. service_role and
-- dedicated worker roles are not changed here.
REVOKE ALL ON public.duty_checklist_settings FROM anon, authenticated;
REVOKE ALL ON public.duty_logs FROM anon, authenticated;
REVOKE ALL ON public.global_settings FROM anon, authenticated;
REVOKE ALL ON public.haifn_items FROM anon, authenticated;
REVOKE ALL ON public.haifn_transactions FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_checklist_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_logs TO authenticated;
GRANT SELECT ON public.global_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_settings TO authenticated;
GRANT SELECT ON public.haifn_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.haifn_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.haifn_transactions TO authenticated;

DO $$
DECLARE
    insecure_table text;
BEGIN
    SELECT c.relname
      INTO insecure_table
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN (
           'duty_checklist_settings', 'duty_logs', 'global_settings',
           'haifn_items', 'haifn_transactions'
       )
       AND NOT c.relrowsecurity
     LIMIT 1;

    IF insecure_table IS NOT NULL THEN
        RAISE EXCEPTION 'RLS is still disabled on public.%', insecure_table;
    END IF;
END;
$$;

COMMIT;
