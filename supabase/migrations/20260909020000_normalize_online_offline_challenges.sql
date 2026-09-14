-- Normalize challenge missions and submissions. The legacy JSON columns are
-- intentionally left in place for recovery only; application code no longer
-- reads or writes them after this migration is deployed.

CREATE TABLE IF NOT EXISTS public.offline_challenge_missions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    legacy_key text,
    title text NOT NULL CHECK (length(trim(title)) > 0),
    description text NOT NULL DEFAULT '',
    location text NOT NULL DEFAULT '',
    verification_type text NOT NULL DEFAULT 'PHOTO'
        CHECK (verification_type IN ('PHOTO', 'TEXT')),
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, legacy_key)
);

CREATE TABLE IF NOT EXISTS public.online_challenge_missions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    legacy_key text,
    title text NOT NULL CHECK (length(trim(title)) > 0),
    description text NOT NULL DEFAULT '',
    schedule_type text NOT NULL DEFAULT 'FLEXIBLE'
        CHECK (schedule_type IN ('DAILY', 'FIXED_DATE', 'FLEXIBLE')),
    fixed_date date,
    target_count integer NOT NULL DEFAULT 1 CHECK (target_count > 0),
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT online_mission_schedule_fields CHECK (
        (schedule_type = 'FIXED_DATE' AND fixed_date IS NOT NULL AND target_count = 1)
        OR (schedule_type = 'DAILY' AND fixed_date IS NULL AND target_count = 1)
        OR (schedule_type = 'FLEXIBLE' AND fixed_date IS NULL)
    ),
    UNIQUE (challenge_id, legacy_key)
);

CREATE INDEX IF NOT EXISTS offline_challenge_missions_active_idx
    ON public.offline_challenge_missions(challenge_id, sort_order) WHERE is_active;
CREATE INDEX IF NOT EXISTS online_challenge_missions_active_idx
    ON public.online_challenge_missions(challenge_id, sort_order) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.offline_challenge_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    mission_id uuid NOT NULL REFERENCES public.offline_challenge_missions(id),
    participant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    auth_text text,
    auth_image_url text,
    status text NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    UNIQUE (mission_id, participant_id)
);

CREATE TABLE IF NOT EXISTS public.online_challenge_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    mission_id uuid NOT NULL REFERENCES public.online_challenge_missions(id),
    participant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id uuid NOT NULL UNIQUE REFERENCES public.community_channel_posts(id),
    completion_date date NOT NULL,
    completion_key text NOT NULL,
    is_valid boolean NOT NULL DEFAULT true,
    invalidated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS online_submission_active_slot_idx
    ON public.online_challenge_submissions(mission_id, participant_id, completion_key)
    WHERE is_valid;
CREATE INDEX IF NOT EXISTS online_submission_progress_idx
    ON public.online_challenge_submissions(challenge_id, participant_id, mission_id)
    WHERE is_valid;

CREATE TABLE IF NOT EXISTS public.community_post_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.community_channel_posts(id) ON DELETE CASCADE,
    media_type text NOT NULL DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE')),
    media_url text NOT NULL CHECK (length(trim(media_url)) > 0),
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (post_id, sort_order)
);

ALTER TABLE public.community_channel_posts
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.community_channel_comments
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notices
    DROP CONSTRAINT IF EXISTS notices_online_community_only;
ALTER TABLE public.notices
    ADD CONSTRAINT notices_online_community_only
    CHECK (NOT community_enabled OR (is_challenge AND challenge_format = 'ONLINE')) NOT VALID;
ALTER TABLE public.community_channel_posts
    DROP CONSTRAINT IF EXISTS community_post_content_required;
ALTER TABLE public.community_channel_posts
    ADD CONSTRAINT community_post_content_required
    CHECK (length(trim(content)) > 0) NOT VALID;

-- Migrate every legacy challenge mission once. Online legacy missions become a
-- single flexible completion by default; administrators can adjust untouched
-- missions after deployment.
INSERT INTO public.offline_challenge_missions (
    challenge_id, legacy_key, title, description, location, verification_type, sort_order
)
SELECT n.id,
       COALESCE(NULLIF(m.value->>'id', ''), 'legacy-' || (m.ordinality - 1)::text),
       COALESCE(NULLIF(trim(m.value->>'title'), ''), '미션 ' || m.ordinality::text),
       COALESCE(m.value->>'description', ''),
       COALESCE(m.value->>'location', ''),
       CASE WHEN lower(COALESCE(m.value->>'verification_type', 'photo')) = 'text' THEN 'TEXT' ELSE 'PHOTO' END,
       (m.ordinality - 1)::integer
FROM public.notices n
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(COALESCE(n.challenge_missions, '[]'::jsonb)) = 'array'
         THEN COALESCE(n.challenge_missions, '[]'::jsonb) ELSE '[]'::jsonb END
) WITH ORDINALITY AS m(value, ordinality)
WHERE n.is_challenge = true AND COALESCE(n.challenge_format, 'OFFLINE') = 'OFFLINE'
ON CONFLICT (challenge_id, legacy_key) DO NOTHING;

INSERT INTO public.online_challenge_missions (
    challenge_id, legacy_key, title, description, schedule_type, fixed_date, target_count, sort_order
)
SELECT n.id,
       COALESCE(NULLIF(m.value->>'id', ''), 'legacy-' || (m.ordinality - 1)::text),
       COALESCE(NULLIF(trim(m.value->>'title'), ''), '미션 ' || m.ordinality::text),
       COALESCE(m.value->>'description', ''),
       CASE WHEN upper(COALESCE(m.value->>'schedule_type', '')) IN ('DAILY','FIXED_DATE','FLEXIBLE')
            THEN upper(m.value->>'schedule_type') ELSE 'FLEXIBLE' END,
       CASE WHEN upper(COALESCE(m.value->>'schedule_type', '')) = 'FIXED_DATE'
            THEN NULLIF(m.value->>'fixed_date', '')::date ELSE NULL END,
       CASE WHEN upper(COALESCE(m.value->>'schedule_type', '')) = 'FLEXIBLE'
            THEN GREATEST(1, COALESCE(NULLIF(m.value->>'target_count', '')::integer, 1)) ELSE 1 END,
       (m.ordinality - 1)::integer
FROM public.notices n
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(COALESCE(n.challenge_missions, '[]'::jsonb)) = 'array'
         THEN COALESCE(n.challenge_missions, '[]'::jsonb) ELSE '[]'::jsonb END
) WITH ORDINALITY AS m(value, ordinality)
WHERE n.is_challenge = true AND n.challenge_format = 'ONLINE'
ON CONFLICT (challenge_id, legacy_key) DO NOTHING;

INSERT INTO public.offline_challenge_submissions (
    challenge_id, mission_id, participant_id, auth_text, auth_image_url, status,
    submitted_at, completed_at
)
SELECT nr.notice_id, om.id, nr.user_id,
       NULLIF(s.value->>'auth_text', ''), NULLIF(s.value->>'auth_image', ''),
       CASE WHEN COALESCE((s.value->>'completed')::boolean, false) THEN 'COMPLETED'
            WHEN COALESCE((s.value->>'pending')::boolean, false) THEN 'PENDING'
            ELSE 'REJECTED' END,
       COALESCE(NULLIF(s.value->>'submitted_at', '')::timestamptz, nr.created_at, now()),
       CASE WHEN COALESCE((s.value->>'completed')::boolean, false)
            THEN COALESCE(NULLIF(s.value->>'completed_at', '')::timestamptz,
                          NULLIF(s.value->>'submitted_at', '')::timestamptz, nr.created_at, now()) END
FROM public.notice_responses nr
JOIN public.notices n ON n.id = nr.notice_id
CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(COALESCE(nr.challenge_mission_statuses, '{}'::jsonb)) = 'object'
         THEN COALESCE(nr.challenge_mission_statuses, '{}'::jsonb) ELSE '{}'::jsonb END
) AS s(key, value)
JOIN public.offline_challenge_missions om
  ON om.challenge_id = nr.notice_id AND om.legacy_key = s.key
WHERE n.is_challenge = true AND COALESCE(n.challenge_format, 'OFFLINE') = 'OFFLINE'
ON CONFLICT (mission_id, participant_id) DO NOTHING;

INSERT INTO public.community_post_media(post_id, media_url, sort_order)
SELECT id, image_url, 0
FROM public.community_channel_posts
WHERE NULLIF(trim(image_url), '') IS NOT NULL
ON CONFLICT (post_id, sort_order) DO NOTHING;

INSERT INTO public.online_challenge_submissions (
    challenge_id, mission_id, participant_id, post_id, completion_date, completion_key
)
SELECT om.challenge_id, om.id, p.author_id, p.id,
       COALESCE(p.mission_date, (p.created_at AT TIME ZONE 'Asia/Seoul')::date),
       CASE om.schedule_type
           WHEN 'DAILY' THEN COALESCE(p.mission_date, (p.created_at AT TIME ZONE 'Asia/Seoul')::date)::text
           WHEN 'FIXED_DATE' THEN 'fixed'
           ELSE p.id::text
       END
FROM public.community_channel_posts p
JOIN public.community_channels c ON c.id = p.channel_id
JOIN public.online_challenge_missions om
  ON om.challenge_id = c.source_notice_id AND om.legacy_key = p.mission_id
WHERE p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.challenge_completion_rewards (
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    participant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id uuid,
    awarded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (challenge_id, participant_id)
);

CREATE OR REPLACE FUNCTION public.is_community_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, calendar_private AS $$
    SELECT EXISTS (
        SELECT 1 FROM calendar_private.admin_identities ai
        WHERE ai.auth_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_current_profile(p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_profile_id AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.validate_challenge_format_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.challenge_format IS DISTINCT FROM OLD.challenge_format AND (
        EXISTS (SELECT 1 FROM public.offline_challenge_submissions s WHERE s.challenge_id = NEW.id)
        OR EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.challenge_id = NEW.id)
    ) THEN
        RAISE EXCEPTION '수행 기록이 있는 챌린지는 온라인/오프라인 유형을 변경할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    IF (NEW.program_start_date IS DISTINCT FROM OLD.program_start_date OR NEW.program_end_date IS DISTINCT FROM OLD.program_end_date)
       AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.challenge_id = NEW.id AND s.is_valid) THEN
        RAISE EXCEPTION '온라인 수행 기록이 있는 챌린지의 시작일과 종료일은 변경할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_challenge_format_change ON public.notices;
CREATE TRIGGER trg_validate_challenge_format_change
BEFORE UPDATE OF challenge_format, program_start_date, program_end_date ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_format_change();

CREATE OR REPLACE FUNCTION public.sync_challenge_missions(
    p_notice_id bigint,
    p_format text,
    p_missions jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item jsonb;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_id uuid;
BEGIN
    IF NOT public.is_community_admin() THEN RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501'; END IF;
    IF p_format NOT IN ('ONLINE', 'OFFLINE') THEN RAISE EXCEPTION '올바르지 않은 챌린지 유형입니다.' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.id = p_notice_id AND n.is_challenge = true AND n.challenge_format = p_format
    ) THEN RAISE EXCEPTION '챌린지 유형이 일치하지 않습니다.' USING ERRCODE = '23514'; END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_missions, '[]'::jsonb)) LOOP
        v_id := COALESCE(NULLIF(v_item->>'id', '')::uuid, gen_random_uuid());
        v_ids := array_append(v_ids, v_id);
        IF p_format = 'ONLINE' THEN
            IF EXISTS (
                SELECT 1 FROM public.online_challenge_missions current_mission
                WHERE current_mission.id = v_id
                  AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = v_id AND s.is_valid)
                  AND (current_mission.schedule_type IS DISTINCT FROM COALESCE(v_item->>'schedule_type', 'FLEXIBLE')
                       OR current_mission.fixed_date IS DISTINCT FROM NULLIF(v_item->>'fixed_date', '')::date
                       OR GREATEST(1, COALESCE(NULLIF(v_item->>'target_count', '')::integer, 1)) <
                          (SELECT count(*) FROM public.online_challenge_submissions s WHERE s.mission_id = v_id AND s.is_valid))
            ) THEN RAISE EXCEPTION '수행 기록이 있는 온라인 미션의 방식·날짜·완료 횟수는 변경할 수 없습니다.' USING ERRCODE = '23514'; END IF;
            INSERT INTO public.online_challenge_missions(
                id, challenge_id, title, description, schedule_type, fixed_date,
                target_count, sort_order, is_active, updated_at
            ) VALUES (
                v_id, p_notice_id, trim(v_item->>'title'), COALESCE(v_item->>'description', ''),
                COALESCE(v_item->>'schedule_type', 'FLEXIBLE'), NULLIF(v_item->>'fixed_date', '')::date,
                GREATEST(1, COALESCE(NULLIF(v_item->>'target_count', '')::integer, 1)),
                COALESCE((v_item->>'sort_order')::integer, array_length(v_ids, 1) - 1), true, now()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                schedule_type = EXCLUDED.schedule_type, fixed_date = EXCLUDED.fixed_date,
                target_count = EXCLUDED.target_count, sort_order = EXCLUDED.sort_order,
                is_active = true, updated_at = now()
            WHERE online_challenge_missions.challenge_id = p_notice_id;
        ELSE
            INSERT INTO public.offline_challenge_missions(
                id, challenge_id, title, description, location, verification_type,
                sort_order, is_active, updated_at
            ) VALUES (
                v_id, p_notice_id, trim(v_item->>'title'), COALESCE(v_item->>'description', ''),
                COALESCE(v_item->>'location', ''), COALESCE(v_item->>'verification_type', 'PHOTO'),
                COALESCE((v_item->>'sort_order')::integer, array_length(v_ids, 1) - 1), true, now()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                location = EXCLUDED.location, verification_type = EXCLUDED.verification_type,
                sort_order = EXCLUDED.sort_order, is_active = true, updated_at = now()
            WHERE offline_challenge_missions.challenge_id = p_notice_id;
        END IF;
    END LOOP;

    IF p_format = 'ONLINE' THEN
        IF EXISTS (
            SELECT 1 FROM public.online_challenge_missions m
            WHERE m.challenge_id = p_notice_id AND m.is_active AND NOT (m.id = ANY(v_ids))
              AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = m.id AND s.is_valid)
        ) THEN RAISE EXCEPTION '수행 기록이 있는 온라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514'; END IF;
        UPDATE public.online_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active AND NOT (id = ANY(v_ids));
        UPDATE public.offline_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active;
    ELSE
        IF EXISTS (
            SELECT 1 FROM public.offline_challenge_missions m
            WHERE m.challenge_id = p_notice_id AND m.is_active AND NOT (m.id = ANY(v_ids))
              AND EXISTS (SELECT 1 FROM public.offline_challenge_submissions s WHERE s.mission_id = m.id)
        ) THEN RAISE EXCEPTION '수행 기록이 있는 오프라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514'; END IF;
        UPDATE public.offline_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active AND NOT (id = ANY(v_ids));
        UPDATE public.online_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_community_channel(p_channel_id uuid, p_profile_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, calendar_private AS $$
    SELECT public.is_community_admin()
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.notices n ON n.id = c.source_notice_id
        JOIN public.notice_responses nr ON nr.notice_id = c.source_notice_id AND nr.status = 'JOIN'
        JOIN public.users u ON u.id = nr.user_id
        WHERE c.id = p_channel_id AND c.status <> 'CLOSED'
          AND n.is_challenge AND n.challenge_format = 'ONLINE' AND n.community_enabled
          AND (u.id = COALESCE(p_profile_id, auth.uid()) OR u.auth_user_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.community_channel_members m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.channel_id = p_channel_id
          AND (u.id = COALESCE(p_profile_id, auth.uid()) OR u.auth_user_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.validate_online_challenge_mission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_notice public.notices%ROWTYPE;
BEGIN
    SELECT * INTO v_notice FROM public.notices WHERE id = NEW.challenge_id;
    IF NOT FOUND OR NOT v_notice.is_challenge OR v_notice.challenge_format <> 'ONLINE' THEN
        RAISE EXCEPTION '온라인 챌린지에만 온라인 미션을 등록할 수 있습니다.' USING ERRCODE = '23514';
    END IF;
    IF NEW.schedule_type = 'FIXED_DATE'
       AND (NEW.fixed_date < v_notice.program_start_date OR NEW.fixed_date > v_notice.program_end_date) THEN
        RAISE EXCEPTION '미션 날짜는 챌린지 기간 안이어야 합니다.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active
       AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = OLD.id AND s.is_valid) THEN
        RAISE EXCEPTION '수행 기록이 있는 온라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE'
       AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = OLD.id AND s.is_valid)
       AND (NEW.schedule_type IS DISTINCT FROM OLD.schedule_type OR NEW.fixed_date IS DISTINCT FROM OLD.fixed_date
            OR NEW.target_count < (SELECT count(*) FROM public.online_challenge_submissions s WHERE s.mission_id = OLD.id AND s.is_valid)) THEN
        RAISE EXCEPTION '수행 기록이 있는 온라인 미션의 방식·날짜·완료 횟수는 변경할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_online_challenge_mission ON public.online_challenge_missions;
CREATE TRIGGER trg_validate_online_challenge_mission
BEFORE INSERT OR UPDATE ON public.online_challenge_missions
FOR EACH ROW EXECUTE FUNCTION public.validate_online_challenge_mission();

CREATE OR REPLACE FUNCTION public.validate_offline_challenge_mission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.id = NEW.challenge_id AND n.is_challenge AND n.challenge_format = 'OFFLINE'
    ) THEN RAISE EXCEPTION '오프라인 챌린지에만 오프라인 미션을 등록할 수 있습니다.' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active
       AND EXISTS (SELECT 1 FROM public.offline_challenge_submissions s WHERE s.mission_id = OLD.id) THEN
        RAISE EXCEPTION '수행 기록이 있는 오프라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_offline_challenge_mission ON public.offline_challenge_missions;
CREATE TRIGGER trg_validate_offline_challenge_mission
BEFORE INSERT OR UPDATE ON public.offline_challenge_missions
FOR EACH ROW EXECUTE FUNCTION public.validate_offline_challenge_mission();

CREATE OR REPLACE FUNCTION public.prepare_offline_challenge_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_mission public.offline_challenge_missions%ROWTYPE;
BEGIN
    SELECT * INTO v_mission FROM public.offline_challenge_missions
    WHERE id = NEW.mission_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION '선택한 오프라인 미션을 찾을 수 없습니다.' USING ERRCODE = '23503'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notice_responses nr
        WHERE nr.notice_id = v_mission.challenge_id AND nr.user_id = NEW.participant_id AND nr.status = 'JOIN'
    ) THEN RAISE EXCEPTION '챌린지 참여자만 인증할 수 있습니다.' USING ERRCODE = '42501'; END IF;
    IF v_mission.verification_type = 'PHOTO' AND NULLIF(trim(NEW.auth_image_url), '') IS NULL THEN
        RAISE EXCEPTION '사진 인증이 필요한 미션입니다.' USING ERRCODE = '23514';
    END IF;
    IF v_mission.verification_type = 'TEXT' AND NULLIF(trim(NEW.auth_text), '') IS NULL THEN
        RAISE EXCEPTION '텍스트 인증이 필요한 미션입니다.' USING ERRCODE = '23514';
    END IF;
    NEW.challenge_id := v_mission.challenge_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_offline_challenge_submission ON public.offline_challenge_submissions;
CREATE TRIGGER trg_prepare_offline_challenge_submission
BEFORE INSERT OR UPDATE ON public.offline_challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.prepare_offline_challenge_submission();

CREATE OR REPLACE FUNCTION public.prepare_online_challenge_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_mission public.online_challenge_missions%ROWTYPE;
    v_notice public.notices%ROWTYPE;
    v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    v_count integer;
BEGIN
    SELECT * INTO v_mission FROM public.online_challenge_missions
    WHERE id = NEW.mission_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '선택한 온라인 미션을 찾을 수 없습니다.' USING ERRCODE = '23503'; END IF;
    SELECT * INTO v_notice FROM public.notices WHERE id = v_mission.challenge_id;
    IF NOT v_notice.is_challenge OR v_notice.challenge_format <> 'ONLINE' OR NOT v_notice.community_enabled THEN
        RAISE EXCEPTION '온라인 커뮤니티 챌린지가 아닙니다.' USING ERRCODE = '23514';
    END IF;
    IF v_today < v_notice.program_start_date OR v_today > v_notice.program_end_date THEN
        RAISE EXCEPTION '챌린지 수행 기간이 아닙니다.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notice_responses nr
        WHERE nr.notice_id = v_notice.id AND nr.user_id = NEW.participant_id AND nr.status = 'JOIN'
    ) THEN RAISE EXCEPTION '챌린지 참여자만 기록할 수 있습니다.' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        JOIN public.community_channels c ON c.id = p.channel_id
        WHERE p.id = NEW.post_id AND p.author_id = NEW.participant_id
          AND p.deleted_at IS NULL AND c.source_notice_id = v_notice.id
    ) THEN RAISE EXCEPTION '게시글과 미션 정보가 일치하지 않습니다.' USING ERRCODE = '23514'; END IF;

    NEW.challenge_id := v_notice.id;
    NEW.completion_date := v_today;
    IF v_mission.schedule_type = 'FIXED_DATE' THEN
        IF v_today <> v_mission.fixed_date THEN RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514'; END IF;
        NEW.completion_key := 'fixed';
    ELSIF v_mission.schedule_type = 'DAILY' THEN
        NEW.completion_key := v_today::text;
    ELSE
        SELECT count(*) INTO v_count FROM public.online_challenge_submissions
        WHERE mission_id = v_mission.id AND participant_id = NEW.participant_id AND is_valid;
        IF v_count >= v_mission.target_count THEN RAISE EXCEPTION '이미 목표 횟수를 완료했습니다.' USING ERRCODE = '23514'; END IF;
        NEW.completion_key := NEW.post_id::text;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_online_challenge_submission ON public.online_challenge_submissions;
CREATE TRIGGER trg_prepare_online_challenge_submission
BEFORE INSERT ON public.online_challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.prepare_online_challenge_submission();

CREATE OR REPLACE FUNCTION public.try_award_online_challenge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_required integer;
    v_completed integer;
    v_reward integer;
    v_title text;
    v_transaction_id uuid;
BEGIN
    SELECT COALESCE(sum(CASE m.schedule_type
               WHEN 'DAILY' THEN (n.program_end_date - n.program_start_date + 1)
               WHEN 'FIXED_DATE' THEN 1 ELSE m.target_count END), 0),
           n.haifn_reward, n.title
      INTO v_required, v_reward, v_title
    FROM public.notices n
    LEFT JOIN public.online_challenge_missions m ON m.challenge_id = n.id AND m.is_active
    WHERE n.id = NEW.challenge_id
    GROUP BY n.id, n.haifn_reward, n.title;

    SELECT count(*) INTO v_completed FROM public.online_challenge_submissions s
    JOIN public.online_challenge_missions m ON m.id = s.mission_id AND m.is_active
    WHERE s.challenge_id = NEW.challenge_id AND s.participant_id = NEW.participant_id AND s.is_valid;

    IF v_required > 0 AND v_completed >= v_required THEN
        INSERT INTO public.challenge_completion_rewards(challenge_id, participant_id)
        VALUES (NEW.challenge_id, NEW.participant_id)
        ON CONFLICT DO NOTHING;
        IF FOUND AND COALESCE(v_reward, 0) > 0 THEN
            INSERT INTO public.haifn_transactions(user_id, amount, transaction_type, source_description, admin_id)
            VALUES (NEW.participant_id, v_reward, 'EARN',
                    '[온라인 챌린지 완료 #' || NEW.challenge_id || '] ' || v_title, NULL)
            RETURNING id INTO v_transaction_id;
            UPDATE public.challenge_completion_rewards
            SET transaction_id = v_transaction_id
            WHERE challenge_id = NEW.challenge_id AND participant_id = NEW.participant_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_online_challenge ON public.online_challenge_submissions;
CREATE TRIGGER trg_award_online_challenge
AFTER INSERT ON public.online_challenge_submissions
FOR EACH ROW WHEN (NEW.is_valid) EXECUTE FUNCTION public.try_award_online_challenge();

CREATE OR REPLACE FUNCTION public.protect_or_invalidate_online_post()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_submission public.online_challenge_submissions%ROWTYPE;
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        SELECT * INTO v_submission FROM public.online_challenge_submissions
        WHERE post_id = NEW.id AND is_valid;
        IF FOUND THEN
            IF EXISTS (
                SELECT 1 FROM public.challenge_completion_rewards r
                WHERE r.challenge_id = v_submission.challenge_id AND r.participant_id = v_submission.participant_id
            ) THEN RAISE EXCEPTION '챌린지 완료 보상이 확정된 기록은 삭제할 수 없습니다.' USING ERRCODE = '23514'; END IF;
            UPDATE public.online_challenge_submissions
            SET is_valid = false, invalidated_at = now()
            WHERE id = v_submission.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_or_invalidate_online_post ON public.community_channel_posts;
CREATE TRIGGER trg_protect_or_invalidate_online_post
BEFORE UPDATE OF deleted_at ON public.community_channel_posts
FOR EACH ROW EXECUTE FUNCTION public.protect_or_invalidate_online_post();

CREATE OR REPLACE FUNCTION public.create_online_challenge_post(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_post_id uuid;
    v_channel_id uuid;
    v_author_id uuid := (p_payload->>'author_id')::uuid;
    v_mission_id uuid := NULLIF(p_payload->>'mission_id', '')::uuid;
BEGIN
    IF length(trim(COALESCE(p_payload->>'content', ''))) = 0 THEN
        RAISE EXCEPTION '글 내용을 입력해주세요.' USING ERRCODE = '23514';
    END IF;
    SELECT id INTO v_channel_id FROM public.community_channels
    WHERE source_notice_id = (p_payload->>'notice_id')::bigint AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION '사용 가능한 챌린지 커뮤니티가 없습니다.' USING ERRCODE = '23503'; END IF;

    INSERT INTO public.community_channel_posts(channel_id, author_id, content)
    VALUES (v_channel_id, v_author_id, trim(p_payload->>'content'))
    RETURNING id INTO v_post_id;

    IF NULLIF(p_payload->>'image_url', '') IS NOT NULL THEN
        INSERT INTO public.community_post_media(post_id, media_url)
        VALUES (v_post_id, p_payload->>'image_url');
    END IF;

    IF v_mission_id IS NOT NULL THEN
        INSERT INTO public.online_challenge_submissions(
            challenge_id, mission_id, participant_id, post_id, completion_date, completion_key
        ) VALUES ((p_payload->>'notice_id')::bigint, v_mission_id, v_author_id, v_post_id,
                  (now() AT TIME ZONE 'Asia/Seoul')::date, v_post_id::text);
    END IF;
    RETURN v_post_id;
END;
$$;

ALTER TABLE public.offline_challenge_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_challenge_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_completion_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offline_missions_read ON public.offline_challenge_missions;
CREATE POLICY offline_missions_read ON public.offline_challenge_missions FOR SELECT USING (is_active OR public.is_community_admin());
DROP POLICY IF EXISTS online_missions_read ON public.online_challenge_missions;
CREATE POLICY online_missions_read ON public.online_challenge_missions FOR SELECT USING (is_active OR public.is_community_admin());
DROP POLICY IF EXISTS challenge_missions_admin_write ON public.offline_challenge_missions;
CREATE POLICY challenge_missions_admin_write ON public.offline_challenge_missions FOR ALL
    USING (public.is_community_admin()) WITH CHECK (public.is_community_admin());
DROP POLICY IF EXISTS online_missions_admin_write ON public.online_challenge_missions;
CREATE POLICY online_missions_admin_write ON public.online_challenge_missions FOR ALL
    USING (public.is_community_admin()) WITH CHECK (public.is_community_admin());

DROP POLICY IF EXISTS offline_submissions_read ON public.offline_challenge_submissions;
CREATE POLICY offline_submissions_read ON public.offline_challenge_submissions FOR SELECT USING (
    public.is_community_admin() OR public.is_current_profile(participant_id)
    OR EXISTS (SELECT 1 FROM public.notice_responses nr WHERE nr.notice_id = challenge_id AND nr.user_id = participant_id AND nr.status = 'JOIN')
);
DROP POLICY IF EXISTS offline_submissions_write ON public.offline_challenge_submissions;
CREATE POLICY offline_submissions_write ON public.offline_challenge_submissions FOR ALL
    USING (public.is_community_admin() OR public.is_current_profile(participant_id))
    WITH CHECK (public.is_community_admin() OR public.is_current_profile(participant_id));

DROP POLICY IF EXISTS online_submissions_read ON public.online_challenge_submissions;
CREATE POLICY online_submissions_read ON public.online_challenge_submissions FOR SELECT USING (
    public.is_community_admin() OR public.is_current_profile(participant_id)
    OR EXISTS (SELECT 1 FROM public.notice_responses nr WHERE nr.notice_id = challenge_id AND nr.user_id = participant_id AND nr.status = 'JOIN')
);
DROP POLICY IF EXISTS online_submissions_insert ON public.online_challenge_submissions;
CREATE POLICY online_submissions_insert ON public.online_challenge_submissions FOR INSERT
    WITH CHECK (public.is_current_profile(participant_id));
DROP POLICY IF EXISTS online_submissions_update ON public.online_challenge_submissions;
CREATE POLICY online_submissions_update ON public.online_challenge_submissions FOR UPDATE
    USING (public.is_current_profile(participant_id) OR public.is_community_admin())
    WITH CHECK (public.is_current_profile(participant_id) OR public.is_community_admin());

DROP POLICY IF EXISTS community_media_read ON public.community_post_media;
CREATE POLICY community_media_read ON public.community_post_media FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.community_channel_posts p WHERE p.id = post_id AND public.can_access_community_channel(p.channel_id))
);
DROP POLICY IF EXISTS community_media_insert ON public.community_post_media;
CREATE POLICY community_media_insert ON public.community_post_media FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.community_channel_posts p WHERE p.id = post_id AND p.author_id IN
        (SELECT u.id FROM public.users u WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()))
);

DROP POLICY IF EXISTS completion_rewards_read ON public.challenge_completion_rewards;
CREATE POLICY completion_rewards_read ON public.challenge_completion_rewards FOR SELECT USING (
    public.is_community_admin() OR public.is_current_profile(participant_id)
);

DROP POLICY IF EXISTS channel_posts_read ON public.community_channel_posts;
CREATE POLICY channel_posts_read ON public.community_channel_posts FOR SELECT USING (
    public.can_access_community_channel(channel_id)
    AND ((NOT is_hidden AND deleted_at IS NULL) OR public.is_community_admin())
);
DROP POLICY IF EXISTS channel_comments_read ON public.community_channel_comments;
CREATE POLICY channel_comments_read ON public.community_channel_comments FOR SELECT USING (
    deleted_at IS NULL AND (NOT is_hidden OR public.is_community_admin())
    AND public.can_access_community_channel((SELECT channel_id FROM public.community_channel_posts WHERE id = post_id))
);

DROP POLICY IF EXISTS channel_comments_insert ON public.community_channel_comments;
CREATE POLICY channel_comments_insert ON public.community_channel_comments FOR INSERT WITH CHECK (
    public.is_current_profile(user_id)
    AND EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        JOIN public.community_channels c ON c.id = p.channel_id
        LEFT JOIN public.notices n ON n.id = c.source_notice_id
        WHERE p.id = post_id AND p.deleted_at IS NULL AND c.status = 'ACTIVE'
          AND public.can_access_community_channel(c.id, user_id)
          AND (n.id IS NULL OR n.program_end_date IS NULL OR n.program_end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date)
    )
);

DROP POLICY IF EXISTS channel_reactions_write ON public.community_channel_reactions;
CREATE POLICY channel_reactions_write ON public.community_channel_reactions FOR ALL USING (
    public.is_current_profile(user_id) OR public.is_community_admin()
) WITH CHECK (
    public.is_current_profile(user_id)
    AND EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        JOIN public.community_channels c ON c.id = p.channel_id
        LEFT JOIN public.notices n ON n.id = c.source_notice_id
        WHERE p.id = post_id AND p.deleted_at IS NULL AND c.status = 'ACTIVE'
          AND public.can_access_community_channel(c.id, user_id)
          AND (n.id IS NULL OR n.program_end_date IS NULL OR n.program_end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date)
    )
);

DROP POLICY IF EXISTS channel_posts_delete ON public.community_channel_posts;
DROP POLICY IF EXISTS channel_posts_update ON public.community_channel_posts;
CREATE POLICY channel_posts_update ON public.community_channel_posts FOR UPDATE
    USING (author_id IN (SELECT id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid()) OR public.is_community_admin())
    WITH CHECK (author_id IN (SELECT id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid()) OR public.is_community_admin());

GRANT SELECT ON public.offline_challenge_missions, public.online_challenge_missions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.offline_challenge_submissions, public.online_challenge_submissions TO authenticated;
GRANT SELECT, INSERT ON public.community_post_media TO authenticated;
GRANT SELECT ON public.challenge_completion_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_challenge_missions(bigint, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_online_challenge_post(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_challenge_missions(bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_online_challenge_post(jsonb) FROM PUBLIC;

COMMENT ON COLUMN public.notices.community_mission_mode IS 'Deprecated: online posts always complete the selected mission immediately.';
COMMENT ON COLUMN public.notices.community_image_required IS 'Deprecated: online challenge images are always optional.';
COMMENT ON COLUMN public.notices.community_after_end IS 'Deprecated: online challenge communities become read-only after the challenge ends.';
