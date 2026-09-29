-- Reviewed additive expand phase. Safe to apply while the new question feature
-- remains disabled; this migration does not change application writes.
-- Do not enable member/guest questions until the reviewed write boundaries
-- attach and validate snapshots atomically in a later coordinated cutover.
BEGIN;

ALTER TABLE public.notices
    ADD COLUMN IF NOT EXISTS application_form jsonb,
    ADD COLUMN IF NOT EXISTS application_form_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.notice_responses
    ADD COLUMN IF NOT EXISTS application_form_revision integer,
    ADD COLUMN IF NOT EXISTS application_form_snapshot jsonb;
ALTER TABLE public.daily_program_session_responses
    ADD COLUMN IF NOT EXISTS application_form_revision integer,
    ADD COLUMN IF NOT EXISTS application_form_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.validate_program_application_form(p_form jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    question jsonb;
    option_value jsonb;
    question_id text;
    question_label text;
    question_type text;
    options jsonb;
    seen_ids text[] := ARRAY[]::text[];
    seen_options text[];
BEGIN
    IF jsonb_typeof(p_form) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_form->'questions') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid application form' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_form->'questions') > 30 THEN
        RAISE EXCEPTION 'Too many application questions' USING ERRCODE = '22023';
    END IF;
    FOR question IN SELECT value FROM jsonb_array_elements(p_form->'questions') LOOP
        question_id := question->>'id';
        question_label := btrim(question->>'label');
        question_type := question->>'type';
        IF jsonb_typeof(question) IS DISTINCT FROM 'object'
            OR question_id IS NULL
            OR jsonb_typeof(question->'id') IS DISTINCT FROM 'string'
            OR question_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
            OR question_id = ANY(seen_ids)
            OR jsonb_typeof(question->'label') IS DISTINCT FROM 'string'
            OR question_label IS NULL OR length(question_label) NOT BETWEEN 1 AND 200
            OR question_type IS NULL OR question_type NOT IN ('text', 'textarea', 'select')
            OR question->>'audience' IS NULL
            OR question->>'audience' NOT IN ('MEMBER', 'GUEST', 'ALL')
            OR jsonb_typeof(question->'required') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'Invalid application question' USING ERRCODE = '22023';
        END IF;
        seen_ids := array_append(seen_ids, question_id);
        options := question->'options';
        IF question_type = 'select' THEN
            IF jsonb_typeof(options) IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Invalid application choices' USING ERRCODE = '22023';
            END IF;
            IF jsonb_array_length(options) NOT BETWEEN 2 AND 30 THEN
                RAISE EXCEPTION 'Invalid application choices' USING ERRCODE = '22023';
            END IF;
            seen_options := ARRAY[]::text[];
            FOR option_value IN SELECT value FROM jsonb_array_elements(options) LOOP
                IF jsonb_typeof(option_value) <> 'string'
                    OR length(btrim(option_value #>> '{}')) NOT BETWEEN 1 AND 200
                    OR btrim(option_value #>> '{}') = ANY(seen_options) THEN
                    RAISE EXCEPTION 'Invalid application choice' USING ERRCODE = '22023';
                END IF;
                seen_options := array_append(seen_options, btrim(option_value #>> '{}'));
            END LOOP;
        ELSIF options IS NOT NULL THEN
            IF jsonb_typeof(options) IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Unexpected application choices' USING ERRCODE = '22023';
            END IF;
            IF jsonb_array_length(options) <> 0 THEN
                RAISE EXCEPTION 'Unexpected application choices' USING ERRCODE = '22023';
            END IF;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_program_application_answers(
    p_form jsonb, p_audience text, p_answers jsonb
) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    answer_key text;
    answer_value jsonb;
    answer_text text;
    question jsonb;
BEGIN
    PERFORM public.validate_program_application_form(p_form);
    IF p_audience IS NULL OR p_audience NOT IN ('MEMBER', 'GUEST')
        OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
        OR octet_length(p_answers::text) > 32768 THEN
        RAISE EXCEPTION 'Invalid application answers' USING ERRCODE = '22023';
    END IF;

    FOR answer_key, answer_value IN SELECT key, value FROM jsonb_each(p_answers) LOOP
        SELECT item.value INTO question
        FROM jsonb_array_elements(p_form->'questions') AS item(value)
        WHERE item.value->>'id' = answer_key
            AND item.value->>'audience' IN (p_audience, 'ALL')
        LIMIT 1;
        IF question IS NULL THEN
            RAISE EXCEPTION 'Answer does not belong to this applicant'
                USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(answer_value) = 'null' THEN CONTINUE; END IF;
        IF jsonb_typeof(answer_value) IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'Invalid answer type' USING ERRCODE = '22023';
        END IF;
        answer_text := answer_value #>> '{}';
        IF answer_text = '' THEN CONTINUE; END IF;
        IF btrim(answer_text) = '' THEN
            RAISE EXCEPTION 'Blank application answer' USING ERRCODE = '22023';
        END IF;
        IF question->>'type' = 'select' THEN
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(question->'options') AS option(value)
                WHERE option.value = answer_text
            ) THEN
                RAISE EXCEPTION 'Invalid application choice' USING ERRCODE = '22023';
            END IF;
        ELSIF length(answer_text) > 3000 THEN
            RAISE EXCEPTION 'Application answer is too long' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    FOR question IN SELECT value FROM jsonb_array_elements(p_form->'questions') LOOP
        IF question->>'audience' IN (p_audience, 'ALL')
            AND question->>'required' = 'true'
            AND btrim(COALESCE(p_answers->>(question->>'id'), '')) = '' THEN
            RAISE EXCEPTION 'Required application answer is missing'
                USING ERRCODE = '22023';
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.revise_program_application_form()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.application_form IS NULL THEN
            NEW.application_form_revision := 0;
        ELSE
            PERFORM public.validate_program_application_form(NEW.application_form);
            NEW.application_form_revision := 1;
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.application_form IS NOT DISTINCT FROM OLD.application_form THEN
        NEW.application_form_revision := OLD.application_form_revision;
        RETURN NEW;
    END IF;
    IF NEW.application_form IS NULL THEN
        RAISE EXCEPTION 'Published application form cannot return to legacy mode'
            USING ERRCODE = '22023';
    END IF;
    PERFORM public.validate_program_application_form(NEW.application_form);
    NEW.application_form_revision := OLD.application_form_revision + 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER revise_program_application_form
    BEFORE INSERT OR UPDATE ON public.notices
    FOR EACH ROW EXECUTE FUNCTION public.revise_program_application_form();

COMMIT;
