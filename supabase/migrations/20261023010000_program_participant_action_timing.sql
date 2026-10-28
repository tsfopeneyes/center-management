-- Ordinary signup programs: cancellation until start, feedback from start.
-- Preserve recruitment, participation, attendance, reward and answer validation. No row updates.
BEGIN;
CREATE OR REPLACE FUNCTION public.program_application_transition(p_notice_id bigint, p_user_id uuid, p_action text, p_audience text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_program public.notices%ROWTYPE;
    v_existing_status text;
    v_status text;
    v_join_count integer;
    v_promote_user uuid;
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('JOIN', 'WAITLIST', 'CANCEL')
        OR p_audience IS NULL OR p_audience NOT IN ('MEMBER', 'GUEST') THEN
        RAISE EXCEPTION 'Invalid application action or audience' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_program FROM public.notices WHERE id = p_notice_id FOR UPDATE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_recruiting IS DISTINCT FROM true
        OR (v_program.is_challenge IS DISTINCT FROM true
            AND COALESCE(v_program.guest_properties->>'application_scope', 'PROGRAM') <> 'PROGRAM')
        OR v_program.program_status IN ('COMPLETED', 'CANCELLED')
        OR v_program.guest_properties->>'is_ended' = 'true'
        OR (p_audience = 'GUEST' AND v_program.guest_properties->>'allow_guest' = 'false') THEN
        RAISE EXCEPTION '프로그램 신청이 비활성화되어 있습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_program.is_leader_only IS TRUE AND (
        p_audience = 'GUEST' OR NOT EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.is_leader IS TRUE
        )
    ) THEN
        RAISE EXCEPTION '리더만 신청할 수 있는 프로그램입니다.' USING ERRCODE = '42501';
    END IF;
    IF v_program.recruitment_start_at IS NOT NULL THEN
        IF clock_timestamp() < v_program.recruitment_start_at THEN
            RAISE EXCEPTION '아직 모집 시작 전입니다.' USING ERRCODE = '23514';
        END IF;
        IF v_program.recruitment_deadline IS NULL
            OR v_program.recruitment_details_ready IS DISTINCT FROM true THEN
            RAISE EXCEPTION '프로그램 신청 정보를 확인해 주세요.' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF v_program.recruitment_deadline IS NOT NULL
        AND clock_timestamp() >= v_program.recruitment_deadline
        AND NOT (p_action = 'CANCEL' AND v_program.is_challenge IS DISTINCT FROM true
            AND coalesce(v_program.guest_properties->>'schedule_mode', '') <> 'RECURRING'
            AND v_program.program_date IS NOT NULL AND clock_timestamp() < v_program.program_date) THEN
        RAISE EXCEPTION '신청 및 취소 기간이 종료되었습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_program.is_challenge IS TRUE
        OR v_program.guest_properties->>'schedule_mode' = 'RECURRING' THEN
        IF v_program.program_end_date IS NOT NULL
            AND clock_timestamp() >= ((v_program.program_end_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') THEN
            RAISE EXCEPTION '프로그램이 종료되었습니다.' USING ERRCODE = '23514';
        END IF;
    ELSIF v_program.program_date IS NOT NULL AND clock_timestamp() >= v_program.program_date THEN
        RAISE EXCEPTION '프로그램이 종료되었습니다.' USING ERRCODE = '23514';
    END IF;

    SELECT status INTO v_existing_status FROM public.notice_responses
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    IF p_action = 'CANCEL' THEN
        IF v_existing_status IS NULL OR v_existing_status = 'CANCELLED' THEN
            RETURN jsonb_build_object('status', 'CANCELLED');
        END IF;
        UPDATE public.notice_responses
            SET status = 'CANCELLED', cancelled_at = clock_timestamp()
            WHERE notice_id = p_notice_id AND user_id = p_user_id;
        IF v_existing_status = 'JOIN' AND v_program.max_capacity > 0 THEN
            SELECT count(*) INTO v_join_count FROM public.notice_responses
                WHERE notice_id = p_notice_id AND status = 'JOIN';
            IF v_join_count < v_program.max_capacity THEN
                SELECT user_id INTO v_promote_user FROM public.notice_responses
                    WHERE notice_id = p_notice_id AND status = 'WAITLIST'
                    ORDER BY created_at, user_id LIMIT 1 FOR UPDATE;
                IF v_promote_user IS NOT NULL THEN
                    UPDATE public.notice_responses SET status = 'JOIN'
                        WHERE notice_id = p_notice_id AND user_id = v_promote_user;
                END IF;
            END IF;
        END IF;
        RETURN jsonb_build_object('status', 'CANCELLED');
    END IF;
    IF v_existing_status IN ('JOIN', 'WAITLIST') THEN
        RETURN jsonb_build_object('status', v_existing_status);
    END IF;
    IF public.program_application_audience_for_user(p_user_id) IS DISTINCT FROM p_audience THEN
        RAISE EXCEPTION '신청자 회원 구분을 확인해 주세요.' USING ERRCODE = '42501';
    END IF;
    IF v_program.application_form IS NULL THEN
        RAISE EXCEPTION '신청 질문 설정을 다시 확인해 주세요.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.validate_program_application_answers(
        v_program.application_form, p_audience, p_answers
    );

    SELECT count(*) INTO v_join_count FROM public.notice_responses
        WHERE notice_id = p_notice_id AND status = 'JOIN';
    v_status := CASE WHEN v_program.max_capacity > 0 AND v_join_count >= v_program.max_capacity
        THEN 'WAITLIST' ELSE 'JOIN' END;
    IF v_existing_status IS NULL THEN
        INSERT INTO public.notice_responses (
            notice_id, user_id, status, is_attended, application_answers,
            application_form_revision, application_form_snapshot, application_audience
        ) VALUES (
            p_notice_id, p_user_id, v_status, false, p_answers,
            v_program.application_form_revision, v_program.application_form, p_audience
        );
    ELSIF v_existing_status = 'CANCELLED' THEN
        UPDATE public.notice_responses SET
            status = v_status, is_attended = false, created_at = clock_timestamp(),
            cancelled_at = NULL, application_answers = p_answers,
            application_form_revision = v_program.application_form_revision,
            application_form_snapshot = v_program.application_form,
            application_audience = p_audience
        WHERE notice_id = p_notice_id AND user_id = p_user_id;
    ELSE
        RAISE EXCEPTION '기존 신청 상태를 관리자에게 확인해 주세요.' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object('status', v_status);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_survey_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE link public.survey_links; program public.notices; definition jsonb; q jsonb; v jsonb; log_row record;
BEGIN
 IF TG_OP='UPDATE' AND (session_user='account_merge_worker' OR current_setting('role',true)='account_merge_worker') THEN
   IF OLD.user_id::text IS DISTINCT FROM current_setting('app.merge_source_id',true)
      OR NEW.user_id::text IS DISTINCT FROM current_setting('app.merge_target_id',true)
      OR (to_jsonb(NEW)-'user_id') IS DISTINCT FROM (to_jsonb(OLD)-'user_id') THEN RAISE EXCEPTION 'Invalid account merge update'; END IF;
   IF EXISTS (SELECT 1 FROM public.survey_entries e WHERE e.link_id=NEW.link_id AND e.user_id=NEW.user_id AND e.response_key=NEW.response_key AND e.id<>NEW.id) THEN
     NEW.response_key:='MERGED:'||NEW.id::text; NEW.aggregation_excluded:=true;
   END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO STRICT link FROM public.survey_links WHERE id = NEW.link_id FOR SHARE;
 IF TG_OP = 'UPDATE' AND NEW.aggregation_excluded IS DISTINCT FROM OLD.aggregation_excluded THEN
   IF NOT public.is_current_staff() OR (to_jsonb(NEW)-'aggregation_excluded') IS DISTINCT FROM (to_jsonb(OLD)-'aggregation_excluded') THEN RAISE EXCEPTION 'Only staff can change aggregation'; END IF;
   RETURN NEW;
 END IF;
 IF NOT public.survey_can_access_user(NEW.user_id) THEN RAISE EXCEPTION 'Survey access denied'; END IF;
 IF NOT link.enabled OR EXISTS (SELECT 1 FROM public.survey_forms WHERE id=link.form_id AND archived)
    OR link.opens_at > now() OR link.closes_at < now() THEN RAISE EXCEPTION 'Survey is closed'; END IF;
 IF EXISTS (SELECT 1 FROM public.survey_forms WHERE id=link.form_id AND kind='TEMPLATE') THEN RAISE EXCEPTION 'Templates cannot collect responses'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF link.event NOT IN ('PROGRAM','PUBLIC') THEN RAISE EXCEPTION 'Visit responses cannot be edited'; END IF;
   IF (to_jsonb(NEW)-'answers'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'answers'-'updated_at') THEN RAISE EXCEPTION 'Response identity is immutable'; END IF;
   definition := OLD.snapshot;
 ELSE
   IF NEW.version_id IS NOT NULL AND NEW.version_id <> link.version_id THEN RAISE EXCEPTION 'Questions changed. Reopen the survey before submitting'; END IF;
   SELECT sv.definition INTO STRICT definition FROM public.survey_versions sv WHERE sv.id=link.version_id;
   NEW.form_id := link.form_id; NEW.version_id := link.version_id; NEW.notice_id := link.notice_id; NEW.snapshot := definition;
   NEW.created_at := now(); NEW.aggregation_excluded := false;
 END IF;
 IF link.event = 'PROGRAM' THEN
   IF auth.uid() IS NULL AND NOT public.is_current_staff() THEN RAISE EXCEPTION 'Sign in to answer program surveys'; END IF;
   SELECT * INTO STRICT program FROM public.notices WHERE id=link.notice_id;
   IF NOT EXISTS (SELECT 1 FROM public.notice_responses r WHERE r.notice_id=link.notice_id AND r.user_id=NEW.user_id
      AND r.status='JOIN' AND (link.audience='JOINED' OR r.is_attended)) THEN RAISE EXCEPTION 'Confirmed participation is required'; END IF;
   IF program.program_status='CANCELLED' THEN RAISE EXCEPTION 'Program is cancelled'; END IF;
   IF link.timing='AFTER_END' AND program.program_status IS DISTINCT FROM 'COMPLETED' AND coalesce(program.guest_properties->>'is_ended','false')<>'true' THEN
     IF program.is_recruiting IS TRUE AND program.is_challenge IS DISTINCT FROM true
       AND coalesce(program.guest_properties->>'schedule_mode', '') <> 'RECURRING' THEN
       IF program.program_date IS NULL OR now() < program.program_date THEN RAISE EXCEPTION 'Survey opens after the program starts'; END IF;
     ELSE
       IF public.survey_program_end_at(to_jsonb(program)) IS NULL OR now() < public.survey_program_end_at(to_jsonb(program)) THEN RAISE EXCEPTION 'Survey opens after the program ends'; END IF;
     END IF;
   END IF;
   NEW.response_key := 'ONCE'; NEW.visit_id := NULL; NEW.location_id := NULL;
 ELSIF link.event = 'PUBLIC' THEN
   IF auth.uid() IS NULL AND NOT public.is_current_staff() THEN RAISE EXCEPTION 'Sign in to answer shared surveys'; END IF;
   NEW.response_key := 'ONCE'; NEW.visit_id := NULL; NEW.location_id := NULL; NEW.notice_id := NULL;
 ELSE
   SELECT l.* INTO log_row FROM public.logs l
     WHERE l.user_id=NEW.user_id AND l.type=link.event AND l.created_at > now()-interval '24 hours'
       AND (NEW.visit_id IS NULL OR l.id::text=NEW.visit_id)
       AND (NEW.location_id IS NULL OR l.location_id=NEW.location_id)
     ORDER BY l.created_at DESC LIMIT 1;
   IF log_row.id IS NULL THEN RAISE EXCEPTION 'A matching recent visit is required'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.locations loc WHERE loc.id=log_row.location_id AND
     CASE WHEN loc.name ~* '(이높|enough|강서)' THEN 'ENOUGH_PLACE' WHEN loc.name ~* '(하이픈|haifn|강동)' THEN 'HAIFN' END=link.center_code)
     THEN RAISE EXCEPTION 'Visit center does not match the survey'; END IF;
   NEW.visit_id := log_row.id::text; NEW.location_id := log_row.location_id;
   NEW.response_key := CASE WHEN link.frequency='ONCE' THEN 'ONCE' ELSE NEW.visit_id END;
 END IF;
 IF jsonb_typeof(NEW.answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Answers must be an object'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(NEW.answers) key WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(definition->'questions') question WHERE question->>'id'=key)) THEN RAISE EXCEPTION 'Unknown question'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(definition->'questions') LOOP
   v := NEW.answers->(q->>'id');
   IF v IS NULL OR v='null'::jsonb OR v='""'::jsonb OR v='[]'::jsonb OR (jsonb_typeof(v)='string' AND trim(v#>>'{}')='') THEN
     IF coalesce((q->>'required')::boolean,false) THEN RAISE EXCEPTION 'Required answer missing: %',q->>'title'; END IF;
     CONTINUE;
   END IF;
   IF q->>'type'='star' AND (jsonb_typeof(v)<>'number' OR (v#>>'{}')::numeric NOT IN (1,2,3,4,5)) THEN RAISE EXCEPTION 'Invalid rating'; END IF;
   IF q->>'type' IN ('short','text') AND (jsonb_typeof(v)<>'string' OR length(v#>>'{}')>5000) THEN RAISE EXCEPTION 'Invalid text'; END IF;
   IF q->>'type'='choice' AND NOT (q->'options' @> jsonb_build_array(v)) THEN RAISE EXCEPTION 'Invalid option'; END IF;
   IF q->>'type'='multiple' THEN
     IF jsonb_typeof(v)<>'array' OR NOT (q->'options' @> v) THEN RAISE EXCEPTION 'Invalid options'; END IF;
     IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(v)) THEN RAISE EXCEPTION 'Duplicate options'; END IF;
   END IF;
 END LOOP;
 NEW.updated_at := now(); RETURN NEW;
END $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
