CREATE OR REPLACE FUNCTION community_security.push_recipient_ids(p_channel_id uuid)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.user_id FROM community_security.member_ids(p_channel_id) m
 UNION
 SELECT u.id FROM public.community_channels c
 JOIN public.notices n ON n.id=c.source_notice_id AND n.is_challenge IS TRUE
 CROSS JOIN LATERAL (
   SELECT to_jsonb(n)->>'host_id' AS id
   UNION ALL SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(to_jsonb(n)->'host_ids')='array' THEN to_jsonb(n)->'host_ids' ELSE '[]'::jsonb END)
   UNION ALL SELECT value->>'host_id' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.hosts)='array' THEN n.hosts ELSE '[]'::jsonb END)
 ) h
 JOIN public.users u ON u.id::text=lower(h.id)
 WHERE c.id=p_channel_id AND coalesce(u.status,'') NOT IN ('withdrawn','deleted');
$$;
REVOKE ALL ON FUNCTION community_security.push_recipient_ids(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.queue_community_post_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE local_time timestamp:=NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.is_hidden OR NOT public.community_channel_is_active(NEW.channel_id) THEN RETURN NEW; END IF;
 IF EXTRACT(HOUR FROM local_time)<9 THEN
   INSERT INTO public.community_post_push_digests(channel_id,user_id,local_date,post_ids,next_attempt_at)
   SELECT NEW.channel_id,m.user_id,local_time::date,ARRAY[NEW.id],(local_time::date+time '09:00') AT TIME ZONE 'Asia/Seoul'
   FROM community_security.push_recipient_ids(NEW.channel_id) m WHERE m.user_id<>NEW.author_id
   ON CONFLICT(channel_id,user_id,local_date) DO UPDATE SET
     post_ids=CASE WHEN NEW.id=ANY(public.community_post_push_digests.post_ids) THEN public.community_post_push_digests.post_ids
       ELSE array_append(public.community_post_push_digests.post_ids,NEW.id) END,updated_at=now();
 ELSE
   INSERT INTO public.community_post_push_recipients(post_id,user_id)
   SELECT NEW.id,m.user_id FROM community_security.push_recipient_ids(NEW.channel_id) m WHERE m.user_id<>NEW.author_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
