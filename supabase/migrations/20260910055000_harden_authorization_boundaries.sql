-- Harden every runtime authorization decision around the canonical private
-- account mapping and role. Public profile role fields are compatibility data
-- only and can no longer be used to claim staff or another profile's identity.

BEGIN;

CREATE OR REPLACE FUNCTION account_security.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT a.profile_id
    FROM account_security.accounts a
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.auth_user_id = auth.uid()
      AND a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND u.status IS DISTINCT FROM 'withdrawn'
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION account_security.current_profile_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT account_security.current_profile_id(); $$;

CREATE OR REPLACE FUNCTION public.is_current_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT coalesce(p_profile_id = account_security.current_profile_id(), false);
$$;

REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_profile(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_staff() TO anon;

-- The optional profile argument remains for API compatibility, but callers can
-- no longer use it to impersonate another profile.
CREATE OR REPLACE FUNCTION public.can_access_community_channel(
    p_channel_id uuid,
    p_profile_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.is_current_staff()
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.notices n ON n.id = c.source_notice_id
        JOIN public.notice_responses nr
          ON nr.notice_id = c.source_notice_id
         AND nr.status = 'JOIN'
        WHERE c.id = p_channel_id
          AND c.status <> 'CLOSED'
          AND n.is_challenge
          AND n.challenge_format = 'ONLINE'
          AND n.community_enabled
          AND nr.user_id = account_security.current_profile_id()
    )
    OR EXISTS (
        SELECT 1
        FROM public.community_channel_members m
        WHERE m.channel_id = p_channel_id
          AND m.user_id = account_security.current_profile_id()
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_community_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_community_channel(uuid, uuid) TO anon, authenticated, service_role;

-- Direct REST writes may update ordinary profile fields, but security fields
-- are controlled only by the account workers and the private role sync trigger.
CREATE OR REPLACE FUNCTION account_security.guard_public_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    request_role text := coalesce(auth.role(), '');
    caller_is_staff boolean := public.is_current_staff();
BEGIN
    IF request_role NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF lower(coalesce(NEW.role, '')) IN ('admin', 'master', 'staff', 'rok')
           OR coalesce(NEW.is_master, false)
           OR NEW.auth_user_id IS NOT NULL
           OR coalesce(NEW.current_haifn, 0) <> 0
           OR coalesce(NEW.is_leader, false) THEN
            RAISE EXCEPTION 'security-managed profile fields cannot be set directly'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_master IS DISTINCT FROM OLD.is_master THEN
        RAISE EXCEPTION 'account identity and role fields are managed by the account service'
            USING ERRCODE = '42501';
    END IF;

    IF NOT caller_is_staff
       AND (
         NEW.status IS DISTINCT FROM OLD.status
         OR NEW.is_leader IS DISTINCT FROM OLD.is_leader
         OR NEW.memo IS DISTINCT FROM OLD.memo
         OR NEW.grade IS DISTINCT FROM OLD.grade
         OR (pg_trigger_depth() <= 1 AND NEW.current_haifn IS DISTINCT FROM OLD.current_haifn)
       ) THEN
        RAISE EXCEPTION 'managed profile fields require staff permission'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION account_security.guard_public_profile_security_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_public_profile_security_fields ON public.users;
CREATE TRIGGER guard_public_profile_security_fields
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION account_security.guard_public_profile_security_fields();

DROP POLICY IF EXISTS authz_guard_users_insert ON public.users;
CREATE POLICY authz_guard_users_insert ON public.users AS RESTRICTIVE
FOR INSERT TO anon, authenticated
WITH CHECK (
    public.is_current_staff()
    OR (
        auth.role() = 'authenticated'
        AND id = auth.uid()
        AND auth_user_id IS NULL
        AND lower(coalesce(role, 'user')) NOT IN ('admin', 'master', 'staff', 'rok')
        AND coalesce(is_master, false) IS FALSE
    )
    OR (
        auth.role() = 'anon'
        AND user_group = '게스트'
        AND auth_user_id IS NULL
        AND password IS NULL
        AND lower(coalesce(role, 'student')) NOT IN ('admin', 'master', 'staff', 'rok')
        AND coalesce(is_master, false) IS FALSE
    )
);

DROP POLICY IF EXISTS authz_guard_users_update ON public.users;
CREATE POLICY authz_guard_users_update ON public.users AS RESTRICTIVE
FOR UPDATE TO anon, authenticated
USING (
    public.is_current_staff()
    OR public.is_current_profile(id)
    OR (auth.role() = 'anon' AND user_group = '게스트' AND auth_user_id IS NULL)
)
WITH CHECK (
    public.is_current_staff()
    OR public.is_current_profile(id)
    OR (auth.role() = 'anon' AND user_group = '게스트' AND auth_user_id IS NULL)
);

DROP POLICY IF EXISTS authz_guard_users_delete ON public.users;
CREATE POLICY authz_guard_users_delete ON public.users AS RESTRICTIVE
FOR DELETE TO anon, authenticated
USING (public.is_current_staff());

-- Administrative configuration is writable only by a canonical staff account.
DO $policy$
DECLARE
    table_name text;
    admin_tables text[] := ARRAY[
        'admin_schedules', 'admin_templates', 'badge_categories', 'badges',
        'calendar_categories', 'contents', 'global_settings', 'location_groups',
        'locations', 'rentals', 'school_logs', 'schools', 'surveys',
        'survey_assignments', 'user_badges'
    ];
BEGIN
    FOREACH table_name IN ARRAY admin_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_staff_insert ON public.%I', table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_staff_insert ON public.%I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (public.is_current_staff())',
            table_name
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_staff_update ON public.%I', table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_staff_update ON public.%I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (public.is_current_staff()) WITH CHECK (public.is_current_staff())',
            table_name
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_staff_delete ON public.%I', table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_staff_delete ON public.%I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (public.is_current_staff())',
            table_name
        );
    END LOOP;
END;
$policy$;

-- Owner-scoped user content. This restrictive layer neutralizes legacy
-- permissive policies without affecting service/maintenance worker roles.
DO $policy$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT * FROM (VALUES
            ('calling_forest_progress', 'student_id'),
            ('comments', 'user_id'),
            ('community_comments', 'author_id'),
            ('community_likes', 'user_id'),
            ('guest_comments', 'user_id'),
            ('guest_post_reactions', 'user_id'),
            ('guest_posts', 'user_id'),
            ('haifn_transactions', 'user_id'),
            ('notice_likes', 'user_id'),
            ('notice_poll_responses', 'user_id'),
            ('program_feedback', 'user_id'),
            ('rental_bookings', 'user_id'),
            ('user_notification_reads', 'user_id')
        ) AS owned(table_name, owner_column)
    LOOP
        IF to_regclass(format('public.%I', item.table_name)) IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_owner_insert ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_owner_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_owner_update ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_owner_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(%I)) WITH CHECK (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column, item.owner_column
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_owner_delete ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_owner_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column
        );
    END LOOP;
END;
$policy$;

-- Message ownership has two legitimate parties.
DROP POLICY IF EXISTS authz_guard_messages_insert ON public.messages;
CREATE POLICY authz_guard_messages_insert ON public.messages AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.is_current_staff() OR public.is_current_profile(sender_id));

DROP POLICY IF EXISTS authz_guard_messages_update ON public.messages;
CREATE POLICY authz_guard_messages_update ON public.messages AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.is_current_staff() OR public.is_current_profile(sender_id) OR public.is_current_profile(receiver_id))
WITH CHECK (public.is_current_staff() OR public.is_current_profile(sender_id) OR public.is_current_profile(receiver_id));

DROP POLICY IF EXISTS authz_guard_messages_delete ON public.messages;
CREATE POLICY authz_guard_messages_delete ON public.messages AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.is_current_staff() OR public.is_current_profile(sender_id) OR public.is_current_profile(receiver_id));

-- Program applications and visit records keep their public guest intake path,
-- while authenticated accounts are limited to the canonical profile.
DO $policy$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT * FROM (VALUES
            ('notice_responses', 'user_id'),
            ('logs', 'user_id'),
            ('checkin_surveys', 'user_id'),
            ('visit_notes', 'user_id')
        ) AS owned(table_name, owner_column)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_member_insert ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_member_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_member_update ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_member_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(%I)) WITH CHECK (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column, item.owner_column
        );
        EXECUTE format('DROP POLICY IF EXISTS authz_guard_member_delete ON public.%I', item.table_name);
        EXECUTE format(
            'CREATE POLICY authz_guard_member_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(%I))',
            item.table_name, item.owner_column
        );
    END LOOP;
END;
$policy$;

-- Non-staff may only increment a notice view count. All authoring fields are
-- protected even though older deployments contain permissive notice policies.
CREATE OR REPLACE FUNCTION public.guard_notice_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
       AND NOT public.is_current_staff()
       AND (
         (to_jsonb(NEW) - 'view_count') IS DISTINCT FROM (to_jsonb(OLD) - 'view_count')
         OR coalesce(NEW.view_count, 0) <> coalesce(OLD.view_count, 0) + 1
       ) THEN
        RAISE EXCEPTION 'only the notice view count can be updated'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_notice_member_update ON public.notices;
CREATE TRIGGER guard_notice_member_update
BEFORE UPDATE ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.guard_notice_member_update();

DROP POLICY IF EXISTS authz_guard_notices_insert ON public.notices;
CREATE POLICY authz_guard_notices_insert ON public.notices AS RESTRICTIVE
FOR INSERT TO anon, authenticated WITH CHECK (public.is_current_staff());
DROP POLICY IF EXISTS authz_guard_notices_delete ON public.notices;
CREATE POLICY authz_guard_notices_delete ON public.notices AS RESTRICTIVE
FOR DELETE TO anon, authenticated USING (public.is_current_staff());

-- Community counters and live-chat reactions are shared fields. Non-owners may
-- change only those explicit shared fields; content and attribution stay owner-
-- or staff-controlled.
CREATE OR REPLACE FUNCTION public.guard_legacy_community_post_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
       AND NOT public.is_current_staff()
       AND NOT public.is_current_profile(OLD.author_id)
       AND (to_jsonb(NEW) - ARRAY['likes_count', 'comments_count', 'updated_at'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['likes_count', 'comments_count', 'updated_at']) THEN
        RAISE EXCEPTION 'community post content belongs to its author'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_legacy_community_post_update ON public.community_posts;
CREATE TRIGGER guard_legacy_community_post_update
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_community_post_update();

DROP POLICY IF EXISTS authz_guard_community_posts_insert ON public.community_posts;
CREATE POLICY authz_guard_community_posts_insert ON public.community_posts AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (public.is_current_staff() OR public.is_current_profile(author_id));
DROP POLICY IF EXISTS authz_guard_community_posts_delete ON public.community_posts;
CREATE POLICY authz_guard_community_posts_delete ON public.community_posts AS RESTRICTIVE
FOR DELETE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(author_id));

CREATE OR REPLACE FUNCTION public.guard_center_chat_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
       AND NOT public.is_current_staff()
       AND NOT public.is_current_profile(OLD.user_id)
       AND (to_jsonb(NEW) - ARRAY['reactions', 'report_count', 'is_hidden'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['reactions', 'report_count', 'is_hidden']) THEN
        RAISE EXCEPTION 'chat content belongs to its author'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_center_chat_update ON public.center_daily_chats;
CREATE TRIGGER guard_center_chat_update
BEFORE UPDATE ON public.center_daily_chats
FOR EACH ROW EXECUTE FUNCTION public.guard_center_chat_update();

DROP POLICY IF EXISTS authz_guard_center_chat_delete ON public.center_daily_chats;
CREATE POLICY authz_guard_center_chat_delete ON public.center_daily_chats AS RESTRICTIVE
FOR DELETE TO authenticated USING (public.is_current_staff() OR public.is_current_profile(user_id));

-- Bell notifications may be authored by staff, by the signed-in sender, or by
-- the verified account flow targeting that same Auth identity.
DROP POLICY IF EXISTS authz_guard_app_notifications_insert ON public.app_notifications;
CREATE POLICY authz_guard_app_notifications_insert ON public.app_notifications AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
    public.is_current_staff()
    OR public.is_current_profile(sender_id)
    OR (sender_id IS NULL AND target_group = 'AUTH_' || auth.uid()::text)
);
DROP POLICY IF EXISTS authz_guard_app_notifications_update ON public.app_notifications;
CREATE POLICY authz_guard_app_notifications_update ON public.app_notifications AS RESTRICTIVE
FOR UPDATE TO authenticated USING (public.is_current_staff()) WITH CHECK (public.is_current_staff());
DROP POLICY IF EXISTS authz_guard_app_notifications_delete ON public.app_notifications;
CREATE POLICY authz_guard_app_notifications_delete ON public.app_notifications AS RESTRICTIVE
FOR DELETE TO authenticated USING (public.is_current_staff());

-- Client roles never need schema-shaping table privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

DO $$
BEGIN
    IF position('public.users' IN pg_get_functiondef('public.is_current_profile(uuid)'::regprocedure)) > 0 THEN
        RAISE EXCEPTION 'profile ownership still depends on public.users';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.users'::regclass
          AND tgname = 'guard_public_profile_security_fields'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'public profile security trigger was not installed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_security.account_roles r
        JOIN public.users u ON u.id = r.profile_id
        WHERE r.enabled IS TRUE
          AND r.role IN ('admin', 'master')
          AND ROW(u.role, u.is_master) IS DISTINCT FROM ROW('admin'::text, r.role = 'master')
    ) THEN
        RAISE EXCEPTION 'public compatibility staff fields are out of sync';
    END IF;
END;
$$;

COMMIT;
