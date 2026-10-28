-- Selected profile IDs, not display-name guessing, identify mention recipients.
ALTER TABLE public.community_channel_comments ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION community_security.contains_mention(p_content text,p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(p_name<>'',false) AND EXISTS(
  SELECT 1 FROM generate_series(1,length(p_content)) pos
  WHERE substr(p_content,pos,length(p_name)+1)='@'||p_name
   AND (pos=1 OR substr(p_content,pos-1,1)~'[[:space:]]')
   AND (pos+length(p_name)+1>length(p_content) OR substr(p_content,pos+length(p_name)+1,1)~'[[:space:][:punct:]]')
 );
$$;
CREATE OR REPLACE FUNCTION community_security.validate_comment_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cid uuid;
BEGIN
 SELECT channel_id INTO cid FROM public.community_channel_posts WHERE id=NEW.post_id;
 SELECT coalesce(array_agg(DISTINCT u.id),'{}'::uuid[]) INTO NEW.mentioned_user_ids
 FROM community_security.push_recipient_ids(cid) m JOIN public.users u ON u.id=m.user_id
 WHERE u.id=ANY(NEW.mentioned_user_ids) AND u.id<>NEW.user_id
 AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
 AND community_security.contains_mention(NEW.content,u.name);
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_comment_mentions BEFORE INSERT OR UPDATE OF content,mentioned_user_ids
 ON public.community_channel_comments FOR EACH ROW EXECUTE FUNCTION community_security.validate_comment_mentions();
REVOKE ALL ON FUNCTION community_security.contains_mention(text,text),community_security.validate_comment_mentions() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.queue_community_comment_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 v_post public.community_channel_posts%ROWTYPE;
 v_local_time timestamp:=NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
 IF NEW.is_hidden THEN RETURN NEW; END IF;
 SELECT * INTO v_post FROM public.community_channel_posts WHERE id=NEW.post_id;
 IF NOT FOUND OR v_post.deleted_at IS NOT NULL OR v_post.is_hidden THEN RETURN NEW; END IF;
 IF NOT public.community_channel_is_active(v_post.channel_id) THEN RETURN NEW; END IF;
 IF EXTRACT(HOUR FROM v_local_time)<9 THEN
  INSERT INTO public.community_post_push_digests(channel_id,user_id,local_date,comment_ids,next_attempt_at)
  SELECT v_post.channel_id,r.user_id,v_local_time::date,ARRAY[NEW.id],(v_local_time::date+time '09:00') AT TIME ZONE 'Asia/Seoul'
  FROM (SELECT v_post.author_id AS user_id UNION SELECT unnest(NEW.mentioned_user_ids)) r WHERE r.user_id<>NEW.user_id
  ON CONFLICT(channel_id,user_id,local_date) DO UPDATE SET
   comment_ids=CASE WHEN NEW.id=ANY(public.community_post_push_digests.comment_ids) THEN public.community_post_push_digests.comment_ids
    ELSE array_append(public.community_post_push_digests.comment_ids,NEW.id) END,updated_at=now();
 ELSE
  INSERT INTO public.community_comment_push_recipients(comment_id,post_id,user_id)
  SELECT NEW.id,NEW.post_id,r.user_id FROM (SELECT v_post.author_id AS user_id UNION SELECT unnest(NEW.mentioned_user_ids)) r
  WHERE r.user_id<>NEW.user_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
