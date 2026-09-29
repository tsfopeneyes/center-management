-- REVIEW DRAFT. Final cutover only after the checked client is deployed and
-- verified. Old browser tabs must refresh; they must not bypass form revision.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.respond_to_program_application(bigint,uuid,text,jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_program_session(uuid,uuid,text,jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_program_session(uuid,uuid,text)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_guest_program_application(bigint,uuid,jsonb,jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT ON public.member_program_applications FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT ON public.guest_program_applications FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT ON public.member_program_session_applications FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT ON public.guest_program_session_applications FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT ON public.guest_program_registration_requests FROM PUBLIC, anon, authenticated;
COMMIT;
