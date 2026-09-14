CREATE OR REPLACE FUNCTION public.get_program_session_participants(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NOT public.is_current_staff() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;

    RETURN coalesce((
        SELECT jsonb_agg(
            jsonb_build_object(
                'user_id', response.user_id,
                'status', response.status,
                'is_attended', response.is_attended,
                'created_at', response.created_at,
                'application_answers', coalesce(response.application_answers, '{}'::jsonb),
                'user', jsonb_build_object(
                    'id', member.id,
                    'name', member.name,
                    'school', member.school,
                    'phone', member.phone,
                    'phone_back4', member.phone_back4,
                    'is_leader', member.is_leader,
                    'user_group', member.user_group
                )
            ) ORDER BY response.created_at
        )
        FROM public.daily_program_session_responses response
        JOIN public.users member ON member.id = response.user_id
        WHERE response.session_id = p_session_id
    ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_program_session_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_program_session_participants(uuid) TO authenticated, service_role;
