-- Queue one push per eligible participant when a community post is committed.
-- The existing minute worker delivers these rows. No historical posts are queued.
CREATE TABLE public.community_post_push_recipients (
    post_id uuid NOT NULL REFERENCES public.community_channel_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED', 'UNCERTAIN')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    attempt_id uuid,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error_code text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX community_post_push_due_idx ON public.community_post_push_recipients(next_attempt_at)
    WHERE state IN ('PENDING', 'FAILED');
ALTER TABLE public.community_post_push_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_push_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_post_push_recipients TO service_role;

CREATE OR REPLACE FUNCTION public.queue_community_post_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL OR NEW.is_hidden THEN RETURN NEW; END IF;

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
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_community_post_push() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_queue_community_post_push ON public.community_channel_posts;
CREATE TRIGGER trg_queue_community_post_push
AFTER INSERT ON public.community_channel_posts
FOR EACH ROW EXECUTE FUNCTION public.queue_community_post_push();

CREATE OR REPLACE FUNCTION public.claim_community_post_push(p_limit integer DEFAULT 40)
RETURNS SETOF public.community_post_push_recipients
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT recipient.post_id, recipient.user_id
        FROM public.community_post_push_recipients recipient
        WHERE recipient.state IN ('PENDING', 'FAILED')
          AND recipient.attempts < 3 AND recipient.next_attempt_at <= now()
        ORDER BY recipient.next_attempt_at, recipient.post_id, recipient.user_id
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.community_post_push_recipients recipient
    SET state = 'SENDING', attempts = recipient.attempts + 1,
        attempt_id = gen_random_uuid(), updated_at = now()
    FROM due
    WHERE recipient.post_id = due.post_id AND recipient.user_id = due.user_id
    RETURNING recipient.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_community_post_push(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_community_post_push(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
