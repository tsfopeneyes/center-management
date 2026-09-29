-- REVIEW DRAFT. A program settings save is one database transaction across
-- the notice, optional survey publication, and optional challenge missions.
-- The column allowlist prevents a SECURITY DEFINER payload from assigning
-- ownership, audit, or unrelated fields. File uploads occur before this call.
BEGIN;
CREATE FUNCTION public.save_program_settings_atomic(
    p_notice_id bigint, p_notice jsonb, p_expected_form_revision integer,
    p_survey jsonb, p_missions jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_allowed constant text[] := ARRAY[
        'title','short_description','content','category','is_sticky','images','image_url',
        'is_recruiting','recruitment_deadline','target_regions','is_poll',
        'allow_multiple_votes','poll_deadline','poll_options','program_date',
        'recruitment_start_at','recruitment_details_ready','program_duration',
        'program_location','program_type','hosts','host_id','host_one_liner',
        'max_capacity','is_leader_only','haifn_reward','is_review_required',
        'is_private','is_challenge','challenge_success_message',
        'challenge_show_haifn_btn','challenge_format','community_enabled',
        'application_form','guest_properties','program_start_date',
        'program_end_date','program_days','program_status'
    ];
    v_bad_key text;
    v_columns text;
    v_values text;
    v_assignments text;
    v_record public.notices%ROWTYPE;
    v_existing public.notices%ROWTYPE;
    v_id bigint;
    v_survey_result jsonb;
    v_revision integer;
BEGIN
    IF public.is_current_staff() IS DISTINCT FROM true THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE='42501';
    END IF;
    IF jsonb_typeof(p_notice) IS DISTINCT FROM 'object'
        OR octet_length(p_notice::text) > 4194304
        OR p_notice->>'category' IS DISTINCT FROM 'PROGRAM'
        OR btrim(COALESCE(p_notice->>'title','')) = ''
        OR p_notice->'application_form' IS NULL
        OR jsonb_typeof(p_notice->'guest_properties') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION '프로그램 설정을 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    SELECT key INTO v_bad_key FROM jsonb_object_keys(p_notice) AS fields(key)
        WHERE NOT key = ANY(v_allowed) LIMIT 1;
    IF v_bad_key IS NOT NULL THEN
        RAISE EXCEPTION '저장할 수 없는 프로그램 필드: %', v_bad_key USING ERRCODE='22023';
    END IF;
    PERFORM public.validate_program_application_form(p_notice->'application_form');
    IF p_survey IS NOT NULL AND (jsonb_typeof(p_survey) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_survey->'definition') IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION '프로그램 설문 설정을 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    IF p_missions IS NOT NULL AND jsonb_typeof(p_missions) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION '챌린지 미션 설정을 확인해 주세요.' USING ERRCODE='22023';
    END IF;
    SELECT string_agg(format('%I',key),',' ORDER BY key),
           string_agg(format('($1).%I',key),',' ORDER BY key),
           string_agg(format('%I=($1).%I',key,key),',' ORDER BY key)
        INTO v_columns,v_values,v_assignments
        FROM jsonb_object_keys(p_notice) AS fields(key);

    IF p_notice_id IS NULL THEN
        v_record := jsonb_populate_record(NULL::public.notices,p_notice);
        v_record.guest_properties := v_record.guest_properties
            - 'custom_fields' - 'survey_version_id';
        EXECUTE format('INSERT INTO public.notices (%s) SELECT %s RETURNING id',
            v_columns,v_values) INTO v_id USING v_record;
    ELSE
        SELECT * INTO v_existing FROM public.notices WHERE id=p_notice_id FOR UPDATE;
        IF NOT FOUND OR v_existing.category <> 'PROGRAM' THEN
            RAISE EXCEPTION '프로그램을 찾을 수 없습니다.' USING ERRCODE='23514';
        END IF;
        IF p_expected_form_revision IS DISTINCT FROM v_existing.application_form_revision THEN
            RAISE EXCEPTION '설정이 변경되었습니다. 새로고침 후 다시 저장해 주세요.' USING ERRCODE='40001';
        END IF;
        v_record := jsonb_populate_record(v_existing,p_notice);
        v_record.guest_properties := (v_record.guest_properties
            - 'custom_fields' - 'survey_version_id')
            || CASE WHEN v_existing.guest_properties ? 'custom_fields'
                THEN jsonb_build_object('custom_fields',v_existing.guest_properties->'custom_fields')
                ELSE '{}'::jsonb END
            || CASE WHEN v_existing.guest_properties ? 'survey_version_id'
                THEN jsonb_build_object('survey_version_id',v_existing.guest_properties->'survey_version_id')
                ELSE '{}'::jsonb END;
        EXECUTE format('UPDATE public.notices SET %s WHERE id=$2 RETURNING id',
            v_assignments) INTO v_id USING v_record,p_notice_id;
    END IF;

    IF p_survey IS NOT NULL THEN
        v_survey_result := public.save_program_survey(
            v_id,NULLIF(p_survey->>'form_id','')::uuid,
            NULLIF(p_survey->>'template_id','')::uuid,p_survey->'definition'
        );
        UPDATE public.notices SET guest_properties = jsonb_set(
            COALESCE(guest_properties,'{}'::jsonb),'{survey_version_id}',
            to_jsonb(v_survey_result->>'version_id'),true
        ) WHERE id=v_id;
    ELSIF p_notice->'guest_properties'->>'enable_feedback' = 'false' THEN
        UPDATE public.survey_links SET enabled=false
            WHERE notice_id=v_id AND event='PROGRAM' AND enabled;
    END IF;
    IF p_missions IS NOT NULL THEN
        IF v_record.is_challenge IS DISTINCT FROM true THEN
            RAISE EXCEPTION '챌린지 미션 대상을 확인해 주세요.' USING ERRCODE='22023';
        END IF;
        PERFORM public.sync_challenge_missions(v_id,v_record.challenge_format,p_missions);
    END IF;
    SELECT application_form_revision INTO v_revision FROM public.notices WHERE id=v_id;
    RETURN jsonb_build_object('id',v_id,'application_form_revision',v_revision,
        'survey',v_survey_result);
END;
$$;
REVOKE ALL ON FUNCTION public.save_program_settings_atomic(bigint,jsonb,integer,jsonb,jsonb)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_program_settings_atomic(bigint,jsonb,integer,jsonb,jsonb)
    TO authenticated;

CREATE VIEW public.program_settings_save_requests AS
    SELECT NULL::bigint AS notice_id,NULL::jsonb AS notice,
        NULL::integer AS expected_form_revision,NULL::jsonb AS survey,
        NULL::jsonb AS missions,NULL::bigint AS saved_notice_id,
        NULL::integer AS application_form_revision,NULL::jsonb AS saved_survey
    WHERE false;
CREATE FUNCTION public.insert_program_settings_save_request()
RETURNS trigger LANGUAGE plpgsql SET search_path=public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
    v_result := public.save_program_settings_atomic(
        NEW.notice_id,NEW.notice,NEW.expected_form_revision,NEW.survey,NEW.missions
    );
    NEW.saved_notice_id := (v_result->>'id')::bigint;
    NEW.application_form_revision := (v_result->>'application_form_revision')::integer;
    NEW.saved_survey := v_result->'survey';
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_program_settings_save_request() FROM PUBLIC;
CREATE TRIGGER program_settings_save_insert
    INSTEAD OF INSERT ON public.program_settings_save_requests
    FOR EACH ROW EXECUTE FUNCTION public.insert_program_settings_save_request();
REVOKE ALL ON public.program_settings_save_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.program_settings_save_requests TO authenticated;
COMMIT;
