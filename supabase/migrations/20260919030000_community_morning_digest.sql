-- One morning notification per community and recipient for posts written
-- between 00:00 and 08:59 in Korea. Daytime posts keep their individual queue.
CREATE TABLE public.community_post_push_digests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    local_date date NOT NULL,
    post_ids uuid[] NOT NULL DEFAULT '{}',
    comment_ids uuid[] NOT NULL DEFAULT '{}',
    state text NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED', 'UNCERTAIN')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    attempt_id uuid,
    next_attempt_at timestamptz NOT NULL,
    last_error_code text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (channel_id, user_id, local_date)
);
CREATE INDEX community_post_push_digest_due_idx ON public.community_post_push_digests(next_attempt_at)
    WHERE state IN ('PENDING', 'FAILED');
ALTER TABLE public.community_post_push_digests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_push_digests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_post_push_digests TO service_role;

CREATE OR REPLACE FUNCTION public.queue_community_post_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    v_local_time timestamp := NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
    IF NEW.deleted_at IS NOT NULL OR NEW.is_hidden THEN RETURN NEW; END IF;

    IF EXTRACT(HOUR FROM v_local_time) < 9 THEN
        INSERT INTO public.community_post_push_digests(
            channel_id, user_id, local_date, post_ids, next_attempt_at
        )
        SELECT NEW.channel_id, participant.user_id, v_local_time::date, ARRAY[NEW.id],
            (v_local_time::date + time '09:00') AT TIME ZONE 'Asia/Seoul'
        FROM public.community_channels channel
        CROSS JOIN LATERAL (
            SELECT response.user_id FROM public.notice_responses response
            WHERE channel.source_notice_id IS NOT NULL
              AND response.notice_id = channel.source_notice_id AND response.status = 'JOIN'
            UNION
            SELECT member.user_id FROM public.community_channel_members member
            WHERE channel.source_notice_id IS NULL AND member.channel_id = channel.id
        ) participant
        WHERE channel.id = NEW.channel_id AND channel.status = 'ACTIVE'
          AND participant.user_id <> NEW.author_id
        ON CONFLICT (channel_id, user_id, local_date) DO UPDATE
        SET post_ids = CASE
                WHEN NEW.id = ANY(public.community_post_push_digests.post_ids)
                THEN public.community_post_push_digests.post_ids
                ELSE array_append(public.community_post_push_digests.post_ids, NEW.id)
            END,
            updated_at = now();
    ELSE
        INSERT INTO public.community_post_push_recipients(post_id, user_id)
        SELECT NEW.id, participant.user_id
        FROM public.community_channels channel
        CROSS JOIN LATERAL (
            SELECT response.user_id FROM public.notice_responses response
            WHERE channel.source_notice_id IS NOT NULL
              AND response.notice_id = channel.source_notice_id AND response.status = 'JOIN'
            UNION
            SELECT member.user_id FROM public.community_channel_members member
            WHERE channel.source_notice_id IS NULL AND member.channel_id = channel.id
        ) participant
        WHERE channel.id = NEW.channel_id AND channel.status = 'ACTIVE'
          AND participant.user_id <> NEW.author_id
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_community_post_push() FROM PUBLIC;

-- Fold already queued quiet-hour posts into the morning digest before the
-- worker can resume at 09:00. Only unsent rows are changed.
WITH quiet AS (
    SELECT p.channel_id, r.user_id,
        (p.created_at AT TIME ZONE 'Asia/Seoul')::date AS local_date,
        array_agg(p.id ORDER BY p.created_at) AS post_ids
    FROM public.community_post_push_recipients r
    JOIN public.community_channel_posts p ON p.id = r.post_id
    WHERE r.state IN ('PENDING', 'FAILED')
      AND EXTRACT(HOUR FROM p.created_at AT TIME ZONE 'Asia/Seoul') < 9
      AND (p.created_at AT TIME ZONE 'Asia/Seoul')::date >=
          (now() AT TIME ZONE 'Asia/Seoul')::date
    GROUP BY p.channel_id, r.user_id, (p.created_at AT TIME ZONE 'Asia/Seoul')::date
)
INSERT INTO public.community_post_push_digests(channel_id, user_id, local_date, post_ids, next_attempt_at)
SELECT channel_id, user_id, local_date, post_ids,
    (local_date + time '09:00') AT TIME ZONE 'Asia/Seoul'
FROM quiet
ON CONFLICT (channel_id, user_id, local_date) DO UPDATE
SET post_ids = ARRAY(
    SELECT DISTINCT id FROM unnest(public.community_post_push_digests.post_ids || EXCLUDED.post_ids) AS id
), updated_at = now();

UPDATE public.community_post_push_recipients r
SET state = 'SKIPPED', last_error_code = 'morning_digest', updated_at = now()
FROM public.community_channel_posts p
WHERE p.id = r.post_id AND r.state IN ('PENDING', 'FAILED')
  AND EXTRACT(HOUR FROM p.created_at AT TIME ZONE 'Asia/Seoul') < 9
  AND (p.created_at AT TIME ZONE 'Asia/Seoul')::date >=
      (now() AT TIME ZONE 'Asia/Seoul')::date;

-- A reply notifies its post author, unless the author wrote the reply.
CREATE TABLE public.community_comment_push_recipients (
    comment_id uuid PRIMARY KEY REFERENCES public.community_channel_comments(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.community_channel_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED', 'UNCERTAIN')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    attempt_id uuid,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error_code text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comment_push_due_idx ON public.community_comment_push_recipients(next_attempt_at)
    WHERE state IN ('PENDING', 'FAILED');
ALTER TABLE public.community_comment_push_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_comment_push_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_comment_push_recipients TO service_role;

CREATE OR REPLACE FUNCTION public.queue_community_comment_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    v_post public.community_channel_posts%ROWTYPE;
    v_channel public.community_channels%ROWTYPE;
    v_local_time timestamp := NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
    IF NEW.is_hidden THEN RETURN NEW; END IF;
    SELECT * INTO v_post FROM public.community_channel_posts WHERE id = NEW.post_id;
    IF NOT FOUND OR v_post.deleted_at IS NOT NULL OR v_post.is_hidden
       OR v_post.author_id = NEW.user_id THEN RETURN NEW; END IF;
    SELECT * INTO v_channel FROM public.community_channels
        WHERE id = v_post.channel_id AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF EXTRACT(HOUR FROM v_local_time) < 9 THEN
        INSERT INTO public.community_post_push_digests(
            channel_id, user_id, local_date, comment_ids, next_attempt_at
        ) VALUES (
            v_channel.id, v_post.author_id, v_local_time::date, ARRAY[NEW.id],
            (v_local_time::date + time '09:00') AT TIME ZONE 'Asia/Seoul'
        ) ON CONFLICT (channel_id, user_id, local_date) DO UPDATE
        SET comment_ids = CASE
                WHEN NEW.id = ANY(public.community_post_push_digests.comment_ids)
                THEN public.community_post_push_digests.comment_ids
                ELSE array_append(public.community_post_push_digests.comment_ids, NEW.id)
            END,
            updated_at = now();
    ELSE
        INSERT INTO public.community_comment_push_recipients(comment_id, post_id, user_id)
        VALUES (NEW.id, NEW.post_id, v_post.author_id);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_community_comment_push() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_queue_community_comment_push ON public.community_channel_comments;
CREATE TRIGGER trg_queue_community_comment_push
AFTER INSERT ON public.community_channel_comments
FOR EACH ROW EXECUTE FUNCTION public.queue_community_comment_push();

CREATE OR REPLACE FUNCTION public.claim_community_comment_push(p_limit integer DEFAULT 40)
RETURNS SETOF public.community_comment_push_recipients
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT recipient.comment_id FROM public.community_comment_push_recipients recipient
        WHERE recipient.state IN ('PENDING', 'FAILED')
          AND recipient.attempts < 3 AND recipient.next_attempt_at <= now()
        ORDER BY recipient.next_attempt_at, recipient.comment_id
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.community_comment_push_recipients recipient
    SET state = 'SENDING', attempts = recipient.attempts + 1,
        attempt_id = gen_random_uuid(), updated_at = now()
    FROM due WHERE recipient.comment_id = due.comment_id
    RETURNING recipient.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_community_comment_push(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_community_comment_push(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_community_post_push_digests(p_limit integer DEFAULT 40)
RETURNS SETOF public.community_post_push_digests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT digest.id FROM public.community_post_push_digests digest
        WHERE digest.state IN ('PENDING', 'FAILED')
          AND digest.attempts < 3 AND digest.next_attempt_at <= now()
        ORDER BY digest.next_attempt_at, digest.id
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.community_post_push_digests digest
    SET state = 'SENDING', attempts = digest.attempts + 1,
        attempt_id = gen_random_uuid(), updated_at = now()
    FROM due WHERE digest.id = due.id
    RETURNING digest.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_community_post_push_digests(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_community_post_push_digests(integer) TO service_role;
NOTIFY pgrst, 'reload schema';
