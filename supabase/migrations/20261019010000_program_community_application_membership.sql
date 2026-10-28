-- Linked channels derive membership only from program applications/attendance.
-- Existing direct member rows and all content remain intact.
BEGIN;
CREATE OR REPLACE FUNCTION community_security.member_ids(p_channel_id uuid)
RETURNS TABLE(user_id uuid,source text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH candidates AS (
   SELECT m.user_id,'DIRECT'::text AS source FROM public.community_channel_members m
     JOIN public.community_channels c ON c.id=m.channel_id
     WHERE m.channel_id=p_channel_id AND m.revoked_at IS NULL AND c.source_notice_id IS NULL
   UNION ALL
   SELECT r.user_id,'PROGRAM'::text FROM public.community_channels c JOIN public.notices n ON n.id=c.source_notice_id
     JOIN public.notice_responses r ON r.notice_id=n.id AND r.status='JOIN'
     WHERE c.id=p_channel_id AND n.community_enabled AND (n.is_challenge OR (n.is_recruiting IS TRUE
       AND NOT (COALESCE(n.guest_properties->>'schedule_mode','')='RECURRING'
         AND COALESCE(n.guest_properties->>'application_scope','')='SESSION')))
   UNION ALL
   SELECT r.user_id,'PROGRAM'::text FROM public.community_channels c JOIN public.notices n ON n.id=c.source_notice_id
     JOIN public.daily_program_sessions s ON s.notice_id=n.id AND s.voided_at IS NULL
     JOIN public.daily_program_session_responses r ON r.session_id=s.id AND (r.status='JOIN' OR r.is_attended)
     WHERE c.id=p_channel_id AND n.community_enabled AND NOT n.is_challenge AND n.is_recruiting IS TRUE
       AND n.guest_properties->>'schedule_mode'='RECURRING' AND n.guest_properties->>'application_scope'='SESSION'
 ) SELECT DISTINCT ON (a.user_id) a.user_id,a.source FROM candidates a JOIN public.users u ON u.id=a.user_id
   WHERE u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
   ORDER BY a.user_id,a.source;
$$;


CREATE OR REPLACE FUNCTION community_security.guard_linked_direct_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.revoked_at IS NULL AND EXISTS(SELECT 1 FROM public.community_channels c WHERE c.id=NEW.channel_id AND c.source_notice_id IS NOT NULL) THEN
   RAISE EXCEPTION '프로그램 참여자 관리에서 신청자를 추가해주세요.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION community_security.guard_linked_direct_member() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_linked_direct_member BEFORE INSERT OR UPDATE OF channel_id,user_id,revoked_at ON public.community_channel_members
FOR EACH ROW EXECUTE FUNCTION community_security.guard_linked_direct_member();
NOTIFY pgrst,'reload schema';
COMMIT;
