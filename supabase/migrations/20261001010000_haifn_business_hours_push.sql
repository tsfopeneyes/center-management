-- Additive only. No existing messages or unread notifications are changed.
BEGIN;
ALTER TABLE public.haifn_chat_sessions ADD COLUMN moderation text NOT NULL DEFAULT 'NORMAL' CHECK(moderation IN ('NORMAL','FILTERED'));
ALTER TABLE public.haifn_chat_sessions ADD COLUMN moderation_reason text;
GRANT SELECT(moderation,moderation_reason),UPDATE(moderation,moderation_reason) ON public.haifn_chat_sessions TO authenticated;
CREATE FUNCTION public.haifn_filter_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.sender='VISITOR' AND lower(regexp_replace(NEW.body,'[[:space:]._*·-]','','g')) ~ '(씨발|시발놈|시발년|씹새끼|개새끼|좆까|좆같|병신|걸레년|보지사진|자지사진|섹스하자|fuckyou|motherfucker)' THEN
  UPDATE public.haifn_chat_sessions SET moderation='FILTERED',moderation_reason='명백한 욕설 또는 외설 표현' WHERE id=NEW.session_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER haifn_filter_message BEFORE INSERT ON public.haifn_chat_messages FOR EACH ROW EXECUTE FUNCTION public.haifn_filter_message();
REVOKE ALL ON FUNCTION public.haifn_filter_message() FROM PUBLIC,anon,authenticated;
-- Existing content is preserved; existing sessions are not automatically reclassified.

CREATE TABLE public.haifn_chat_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL REFERENCES public.haifn_chat_messages(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL REFERENCES public.haifn_chat_sessions(id) ON DELETE RESTRICT,
 recipient_id uuid NOT NULL REFERENCES public.haifn_chat_operators(user_id) ON DELETE RESTRICT,
 question_at timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN ('NEW','REMINDER')),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','SENDING','FAILED','SENT','SKIPPED','CANCELLED','DEAD','UNCERTAIN')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), last_error_code text,
 UNIQUE(message_id,recipient_id,kind)
);
ALTER TABLE public.haifn_chat_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.haifn_chat_push_deliveries FROM PUBLIC,anon,authenticated;
CREATE INDEX haifn_chat_push_due ON public.haifn_chat_push_deliveries(next_attempt_at) WHERE state IN ('PENDING','FAILED');

CREATE FUNCTION public.haifn_next_business_morning(at_time timestamptz) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE day_date date := (at_time AT TIME ZONE 'Asia/Seoul')::date + 1;
BEGIN
 WHILE extract(isodow FROM day_date)>5 LOOP day_date:=day_date+1; END LOOP;
 RETURN (day_date + time '10:00') AT TIME ZONE 'Asia/Seoul';
END $$;

CREATE FUNCTION public.haifn_queue_visitor_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE local_time timestamp := NEW.created_at AT TIME ZONE 'Asia/Seoul'; morning timestamptz;
BEGIN
 IF NEW.sender <> 'VISITOR' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.haifn_chat_sessions WHERE id=NEW.session_id AND moderation='FILTERED') THEN RETURN NEW; END IF;
 IF extract(isodow FROM local_time)<=5 AND local_time::time>=time '10:00' AND local_time::time<time '18:00' THEN
   INSERT INTO public.haifn_chat_push_deliveries(message_id,session_id,recipient_id,question_at,kind,next_attempt_at)
   SELECT NEW.id,NEW.session_id,user_id,NEW.created_at,'NEW',NEW.created_at FROM public.haifn_chat_operators;
 END IF;
 -- Before opening on a weekday, notify at that day's opening; otherwise next weekday.
 morning:=CASE WHEN extract(isodow FROM local_time)<=5 AND local_time::time<time '10:00'
   THEN (local_time::date+time '10:00') AT TIME ZONE 'Asia/Seoul'
   ELSE public.haifn_next_business_morning(NEW.created_at) END;
 INSERT INTO public.haifn_chat_push_deliveries(message_id,session_id,recipient_id,question_at,kind,next_attempt_at)
 SELECT NEW.id,NEW.session_id,user_id,NEW.created_at,'REMINDER',morning FROM public.haifn_chat_operators;
 RETURN NEW;
END $$;
CREATE TRIGGER haifn_queue_visitor_push AFTER INSERT ON public.haifn_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.haifn_queue_visitor_push();

CREATE FUNCTION public.haifn_tick_push() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE local_time timestamp:=now() AT TIME ZONE 'Asia/Seoul';
BEGIN
 IF extract(isodow FROM local_time)>5 OR local_time::time<time '10:00' OR local_time::time>=time '18:00' THEN RETURN; END IF;
 UPDATE public.haifn_chat_push_deliveries SET state='FAILED',updated_at=now(),next_attempt_at=now()
 WHERE state='SENDING' AND updated_at<now()-interval '5 minutes';
 -- Only the latest unanswered visitor message per conversation needs a reminder.
 UPDATE public.haifn_chat_push_deliveries q SET state='CANCELLED',updated_at=now()
 WHERE q.state IN ('PENDING','FAILED') AND ((q.kind='NEW' AND (q.question_at AT TIME ZONE 'Asia/Seoul')::date < local_time::date) OR EXISTS(SELECT 1 FROM public.haifn_chat_sessions s WHERE s.id=q.session_id AND (s.status='DONE' OR s.moderation='FILTERED'))
 OR EXISTS(SELECT 1 FROM public.haifn_chat_messages m WHERE m.session_id=q.session_id AND m.sender='STAFF' AND m.created_at>=q.question_at)
 OR (q.kind='REMINDER' AND EXISTS(SELECT 1 FROM public.haifn_chat_messages m WHERE m.session_id=q.session_id AND m.sender='VISITOR' AND m.created_at>q.question_at)));
 IF EXISTS(SELECT 1 FROM public.haifn_chat_push_deliveries WHERE state IN ('PENDING','FAILED') AND next_attempt_at<=now() AND attempts<5) THEN
  PERFORM public.dm_invoke_notification_worker();
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.haifn_queue_visitor_push(),public.haifn_tick_push() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('haifn-business-hours-push','* * * * *','SELECT public.haifn_tick_push()');
COMMIT;
