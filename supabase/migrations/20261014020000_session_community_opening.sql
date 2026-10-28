BEGIN;
CREATE FUNCTION community_security.recruitment_has_started(p_notice_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN n.is_recruiting IS TRUE AND NOT n.is_challenge
   AND n.guest_properties->>'schedule_mode'='RECURRING' AND n.guest_properties->>'application_scope'='SESSION'
   THEN EXISTS(SELECT 1 FROM public.daily_program_sessions s WHERE s.notice_id=n.id)
   ELSE n.recruitment_start_at IS NULL OR n.recruitment_start_at<=now() END
 FROM public.notices n WHERE n.id=p_notice_id;
$$;
REVOKE ALL ON FUNCTION community_security.recruitment_has_started(bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION community_security.effective_status(p_channel_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN c.source_notice_id IS NOT NULL AND c.status='SCHEDULED'
   AND community_security.recruitment_has_started(c.source_notice_id) THEN 'ACTIVE' ELSE c.status END
 FROM public.community_channels c WHERE c.id=p_channel_id;
$$;
CREATE OR REPLACE FUNCTION community_security.guard_channel_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.source_notice_id IS NOT NULL AND NEW.status IN('ACTIVE','SCHEDULED')
   AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.source_notice_id IS DISTINCT FROM OLD.source_notice_id) THEN
   NEW.status:=CASE WHEN community_security.recruitment_has_started(NEW.source_notice_id) THEN 'ACTIVE' ELSE 'SCHEDULED' END;
 END IF;
 RETURN NEW;
END;
$$;
-- Preserve the reviewed ownership/concurrency checks; change only the opening rule.
DO $$
DECLARE definition text:=pg_get_functiondef('public.sync_notice_community_channel()'::regprocedure);
BEGIN
 IF position('initial_status:=CASE WHEN NEW.recruitment_start_at>now()' IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected community synchronization definition';
 END IF;
 EXECUTE replace(definition,
   'initial_status:=CASE WHEN NEW.recruitment_start_at>now() THEN ''SCHEDULED'' ELSE ''ACTIVE'' END;',
   'initial_status:=CASE WHEN community_security.recruitment_has_started(NEW.id) THEN ''ACTIVE'' ELSE ''SCHEDULED'' END;');
END;
$$;
-- Reconcile only not-yet-opened session channels, if one was linked between releases.
UPDATE public.community_channels c SET status='SCHEDULED'
FROM public.notices n WHERE c.source_notice_id=n.id AND c.status='ACTIVE'
 AND n.is_recruiting IS TRUE AND NOT n.is_challenge
 AND n.guest_properties->>'schedule_mode'='RECURRING' AND n.guest_properties->>'application_scope'='SESSION'
 AND NOT community_security.recruitment_has_started(n.id);
NOTIFY pgrst,'reload schema';
COMMIT;
