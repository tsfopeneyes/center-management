-- Preserve historical transactions. Serialize every positive visit award with
-- the balance row, including direct inserts and historical auto settlements.
CREATE OR REPLACE FUNCTION public.guard_daily_visit_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    reward_day date;
    effective_amount bigint;
BEGIN
    IF NEW.amount <= 0 OR NEW.amount IS NULL THEN RETURN NEW; END IF;
    IF NEW.source_description = '공간 방문 (1일 1회)' THEN
        reward_day := (NEW.created_at AT TIME ZONE 'Asia/Seoul')::date;
    ELSIF NEW.source_description ~ '^\[자동 정산\] 공간 방문 \([0-9]{4}-[0-9]{2}-[0-9]{2}\)$' THEN
        reward_day := substring(NEW.source_description from '[0-9]{4}-[0-9]{2}-[0-9]{2}')::date;
    ELSE
        RETURN NEW;
    END IF;

    -- A row lock is shared with the existing balance UPDATE, and is retained
    -- until commit. Under READ COMMITTED the following SELECT sees the prior
    -- award after waiting. Stronger isolation rejects/retries a stale writer.
    PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR UPDATE;
    SELECT coalesce(sum(t.amount), 0) INTO effective_amount
    FROM public.haifn_transactions t
    WHERE t.user_id = NEW.user_id AND (
        (t.source_description = '공간 방문 (1일 1회)'
         AND t.created_at >= reward_day::timestamp AT TIME ZONE 'Asia/Seoul'
         AND t.created_at < (reward_day + 1)::timestamp AT TIME ZONE 'Asia/Seoul')
        OR t.source_description = '[자동 정산] 공간 방문 (' || reward_day::text || ')'
    );
    IF effective_amount + NEW.amount > 1 THEN
        RAISE EXCEPTION 'Visit reward already settled for this member and KST day'
            USING ERRCODE = '23505', CONSTRAINT = 'daily_visit_reward_limit';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_daily_visit_reward() FROM PUBLIC;
CREATE TRIGGER guard_daily_visit_reward
BEFORE INSERT ON public.haifn_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_daily_visit_reward();
