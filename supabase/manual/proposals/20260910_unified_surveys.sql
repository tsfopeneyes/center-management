-- REVIEW REQUIRED. Additive migration; do not apply to production without approval.
-- Prerequisites: is_current_staff(), is_current_profile(uuid), existing visits,
-- notice_responses and haifn_transactions. Historical survey rows are untouched.
BEGIN;
CREATE TABLE public.survey_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL,
  archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.survey_forms(id),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition->'questions') = 'array' AND jsonb_array_length(definition->'questions') > 0),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, form_id)
);
CREATE TABLE public.survey_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.survey_forms(id),
  version_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('CHECKIN','CHECKOUT','PROGRAM')),
  center_code text CHECK (center_code IN ('HAIFN','ENOUGH_PLACE')),
  notice_id bigint REFERENCES public.notices(id),
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'ONCE' CHECK (frequency IN ('ONCE','EVERY_VISIT')),
  priority integer NOT NULL DEFAULT 100, is_default boolean NOT NULL DEFAULT false,
  opens_at timestamptz, closes_at timestamptz,
  audience text NOT NULL DEFAULT 'ATTENDED' CHECK (audience IN ('ATTENDED','JOINED')),
  timing text NOT NULL DEFAULT 'AFTER_END' CHECK (timing IN ('AFTER_END','ANYTIME')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, form_id) REFERENCES public.survey_versions(id, form_id),
  CHECK ((event = 'PROGRAM' AND notice_id IS NOT NULL AND center_code IS NULL AND frequency = 'ONCE')
      OR (event <> 'PROGRAM' AND notice_id IS NULL AND center_code IS NOT NULL)),
  CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at)
);
CREATE UNIQUE INDEX survey_one_program_link ON public.survey_links(notice_id) WHERE enabled AND event = 'PROGRAM';
CREATE UNIQUE INDEX survey_one_center_form_link ON public.survey_links(form_id,center_code,event) WHERE enabled AND event <> 'PROGRAM';
CREATE INDEX survey_links_target ON public.survey_links(center_code,event);
CREATE TABLE public.survey_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.survey_links(id),
  form_id uuid NOT NULL REFERENCES public.survey_forms(id),
  version_id uuid NOT NULL REFERENCES public.survey_versions(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  notice_id bigint REFERENCES public.notices(id),
  location_id text, visit_id text,
  response_key text NOT NULL,
  snapshot jsonb NOT NULL, answers jsonb NOT NULL,
  aggregation_excluded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id,user_id,response_key)
);
CREATE INDEX survey_entries_form ON public.survey_entries(form_id,created_at);
CREATE INDEX survey_entries_program ON public.survey_entries(notice_id);

-- A recent visit ID acts as a narrow receipt for the existing guest/kiosk
-- intake path. It grants access only to that visitor's survey entries.
CREATE FUNCTION public.survey_can_access_user(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.is_current_staff() OR public.is_current_profile(p_user) OR (
   auth.uid() IS NULL AND EXISTS (
     SELECT 1 FROM public.logs l WHERE l.user_id = p_user
     AND l.id::text = (coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-survey-visit')
     AND l.created_at > now() - interval '24 hours'
   )
 )
$$;
REVOKE ALL ON FUNCTION public.survey_can_access_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.survey_can_access_user(uuid) TO anon,authenticated;

CREATE FUNCTION public.guard_survey_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q jsonb; ids text[] := '{}'; satisfaction_count int := 0;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Published survey versions are immutable'; END IF;
 IF nullif(trim(NEW.definition->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Survey title is required'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(NEW.definition->'questions') LOOP
   IF nullif(q->>'id','') IS NULL OR (q->>'id') = ANY(ids) OR nullif(trim(q->>'title'),'') IS NULL
      OR coalesce(q->>'type','') NOT IN ('short','text','choice','multiple','star') THEN RAISE EXCEPTION 'Invalid question'; END IF;
   ids := array_append(ids,q->>'id');
   IF q->>'type' IN ('choice','multiple') THEN
     IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'options') < 2 THEN RAISE EXCEPTION 'Two options required'; END IF;
     IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE jsonb_typeof(o) <> 'string' OR trim(o#>>'{}') = '')
        OR (SELECT count(*) <> count(DISTINCT value) FROM jsonb_array_elements(q->'options')) THEN RAISE EXCEPTION 'Invalid options'; END IF;
   END IF;
   IF q->>'metric' = 'satisfaction' THEN
     IF q->>'type' <> 'star' THEN RAISE EXCEPTION 'Satisfaction must be a star question'; END IF;
     satisfaction_count := satisfaction_count + 1;
   END IF;
 END LOOP;
 IF satisfaction_count > 1 THEN RAISE EXCEPTION 'Only one satisfaction question is allowed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_survey_version BEFORE INSERT OR UPDATE OR DELETE ON public.survey_versions FOR EACH ROW EXECUTE FUNCTION public.guard_survey_version();

CREATE FUNCTION public.survey_program_end_at(program jsonb) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE start_at timestamptz; end_day date; duration text; hours text[]; minutes text[]; duration_minutes numeric := 60;
BEGIN
 end_day := nullif(program->>'program_end_date','')::date;
 start_at := nullif(program->>'program_date','')::timestamptz;
 IF start_at IS NULL THEN RETURN CASE WHEN end_day IS NULL THEN NULL ELSE ((end_day+1)::timestamp AT TIME ZONE 'Asia/Seoul') END; END IF;
 duration := coalesce(program->>'program_duration','');
 hours := regexp_match(duration,'([0-9.]+)\s*(시간|h)','i'); minutes := regexp_match(duration,'([0-9.]+)\s*(분|m)','i');
 IF hours IS NOT NULL OR minutes IS NOT NULL THEN duration_minutes := coalesce(hours[1]::numeric,0)*60+coalesce(minutes[1]::numeric,0);
 ELSIF duration ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' AND duration::numeric>0 THEN duration_minutes := CASE WHEN duration::numeric<=12 THEN duration::numeric*60 ELSE duration::numeric END; END IF;
 IF duration_minutes<=0 THEN duration_minutes:=60; END IF;
 IF end_day IS NOT NULL THEN start_at := (end_day+(start_at AT TIME ZONE 'Asia/Seoul')::time) AT TIME ZONE 'Asia/Seoul'; END IF;
 RETURN start_at + make_interval(secs=>(duration_minutes*60)::double precision);
END $$;
CREATE FUNCTION public.guard_survey_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE link public.survey_links; program public.notices; definition jsonb; q jsonb; v jsonb; log_row record;
BEGIN
 IF TG_OP='UPDATE' AND (session_user='account_merge_worker' OR current_setting('role',true)='account_merge_worker') THEN
   IF OLD.user_id::text IS DISTINCT FROM current_setting('app.merge_source_id',true)
      OR NEW.user_id::text IS DISTINCT FROM current_setting('app.merge_target_id',true)
      OR (to_jsonb(NEW)-'user_id') IS DISTINCT FROM (to_jsonb(OLD)-'user_id') THEN RAISE EXCEPTION 'Invalid account merge update'; END IF;
   IF EXISTS (SELECT 1 FROM public.survey_entries e WHERE e.link_id=NEW.link_id AND e.user_id=NEW.user_id AND e.response_key=NEW.response_key AND e.id<>NEW.id) THEN
     NEW.response_key:='MERGED:'||NEW.id::text; NEW.aggregation_excluded:=true;
   END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO STRICT link FROM public.survey_links WHERE id = NEW.link_id FOR SHARE;
 IF TG_OP = 'UPDATE' AND NEW.aggregation_excluded IS DISTINCT FROM OLD.aggregation_excluded THEN
   IF NOT public.is_current_staff() OR (to_jsonb(NEW)-'aggregation_excluded') IS DISTINCT FROM (to_jsonb(OLD)-'aggregation_excluded') THEN RAISE EXCEPTION 'Only staff can change aggregation'; END IF;
   RETURN NEW;
 END IF;
 IF NOT public.survey_can_access_user(NEW.user_id) THEN RAISE EXCEPTION 'Survey access denied'; END IF;
 IF NOT link.enabled OR EXISTS (SELECT 1 FROM public.survey_forms WHERE id=link.form_id AND archived)
    OR link.opens_at > now() OR link.closes_at < now() THEN RAISE EXCEPTION 'Survey is closed'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF link.event <> 'PROGRAM' THEN RAISE EXCEPTION 'Visit responses cannot be edited'; END IF;
   IF (to_jsonb(NEW)-'answers'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'answers'-'updated_at') THEN RAISE EXCEPTION 'Response identity is immutable'; END IF;
   definition := OLD.snapshot;
 ELSE
   IF NEW.version_id IS NOT NULL AND NEW.version_id <> link.version_id THEN RAISE EXCEPTION 'Questions changed. Reopen the survey before submitting'; END IF;
   SELECT v.definition INTO STRICT definition FROM public.survey_versions v WHERE v.id=link.version_id;
   NEW.form_id := link.form_id; NEW.version_id := link.version_id; NEW.notice_id := link.notice_id; NEW.snapshot := definition;
   NEW.created_at := now(); NEW.aggregation_excluded := false;
 END IF;
 IF link.event = 'PROGRAM' THEN
   IF auth.uid() IS NULL AND NOT public.is_current_staff() THEN RAISE EXCEPTION 'Sign in to answer program surveys'; END IF;
   SELECT * INTO STRICT program FROM public.notices WHERE id=link.notice_id;
   IF NOT EXISTS (SELECT 1 FROM public.notice_responses r WHERE r.notice_id=link.notice_id AND r.user_id=NEW.user_id
      AND r.status='JOIN' AND (link.audience='JOINED' OR r.is_attended)) THEN RAISE EXCEPTION 'Confirmed participation is required'; END IF;
   IF program.program_status='CANCELLED' THEN RAISE EXCEPTION 'Program is cancelled'; END IF;
   IF link.timing='AFTER_END' AND program.program_status IS DISTINCT FROM 'COMPLETED' AND coalesce(program.guest_properties->>'is_ended','false')<>'true' THEN
     IF public.survey_program_end_at(to_jsonb(program)) IS NULL OR now() < public.survey_program_end_at(to_jsonb(program)) THEN RAISE EXCEPTION 'Survey opens after the program ends'; END IF;
   END IF;
   NEW.response_key := 'ONCE'; NEW.visit_id := NULL; NEW.location_id := NULL;
 ELSE
   SELECT l.* INTO log_row FROM public.logs l
     WHERE l.user_id=NEW.user_id AND l.type=link.event AND l.created_at > now()-interval '24 hours'
       AND (NEW.visit_id IS NULL OR l.id::text=NEW.visit_id)
       AND (NEW.location_id IS NULL OR l.location_id=NEW.location_id)
     ORDER BY l.created_at DESC LIMIT 1;
   IF log_row.id IS NULL THEN RAISE EXCEPTION 'A matching recent visit is required'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.locations loc WHERE loc.id=log_row.location_id AND
     CASE WHEN loc.name ~* '(이높|enough|강서)' THEN 'ENOUGH_PLACE' WHEN loc.name ~* '(하이픈|haifn|강동)' THEN 'HAIFN' END=link.center_code)
     THEN RAISE EXCEPTION 'Visit center does not match the survey'; END IF;
   NEW.visit_id := log_row.id::text; NEW.location_id := log_row.location_id;
   NEW.response_key := CASE WHEN link.frequency='ONCE' THEN 'ONCE' ELSE NEW.visit_id END;
 END IF;
 IF jsonb_typeof(NEW.answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Answers must be an object'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(NEW.answers) key WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(definition->'questions') question WHERE question->>'id'=key)) THEN RAISE EXCEPTION 'Unknown question'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(definition->'questions') LOOP
   v := NEW.answers->(q->>'id');
   IF v IS NULL OR v='null'::jsonb OR v='""'::jsonb OR v='[]'::jsonb OR (jsonb_typeof(v)='string' AND trim(v#>>'{}')='') THEN
     IF coalesce((q->>'required')::boolean,false) THEN RAISE EXCEPTION 'Required answer missing: %',q->>'title'; END IF;
     CONTINUE;
   END IF;
   IF q->>'type'='star' AND (jsonb_typeof(v)<>'number' OR (v#>>'{}')::numeric NOT IN (1,2,3,4,5)) THEN RAISE EXCEPTION 'Invalid rating'; END IF;
   IF q->>'type' IN ('short','text') AND (jsonb_typeof(v)<>'string' OR length(v#>>'{}')>5000) THEN RAISE EXCEPTION 'Invalid text'; END IF;
   IF q->>'type'='choice' AND NOT (q->'options' @> jsonb_build_array(v)) THEN RAISE EXCEPTION 'Invalid option'; END IF;
   IF q->>'type'='multiple' THEN
     IF jsonb_typeof(v)<>'array' OR NOT (q->'options' @> v) THEN RAISE EXCEPTION 'Invalid options'; END IF;
     IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(v)) THEN RAISE EXCEPTION 'Duplicate options'; END IF;
   END IF;
 END LOOP;
 NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER guard_survey_entry BEFORE INSERT OR UPDATE ON public.survey_entries FOR EACH ROW EXECUTE FUNCTION public.guard_survey_entry();

-- Reward and response commit together; editing/retrying/switching forms cannot
-- produce another program reward. Existing program reward descriptions count.
CREATE FUNCTION public.reward_survey_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE program public.notices;
BEGIN
 IF NEW.notice_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO program FROM public.notices WHERE id=NEW.notice_id;
 IF NOT coalesce(program.is_review_required,false) OR coalesce(program.haifn_reward,0)<=0 THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text||NEW.notice_id::text,0));
 -- Historical rewards used mutable program titles. A previous legacy review
 -- prevents issuing a second reward even if the program has since been renamed.
 IF EXISTS (SELECT 1 FROM public.program_feedback f WHERE f.notice_id=NEW.notice_id AND f.user_id=NEW.user_id) THEN RETURN NEW; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.haifn_transactions WHERE user_id=NEW.user_id AND transaction_type='EARN' AND
   source_description IN ('[설문 완료] 프로그램:'||NEW.notice_id::text,'[프로그램 참여] '||program.title,'[프로그램 참여] '||program.title||' (리뷰 작성 완료)')) THEN
   INSERT INTO public.haifn_transactions(user_id,amount,transaction_type,source_description)
   VALUES (NEW.user_id,program.haifn_reward,'EARN','[설문 완료] 프로그램:'||NEW.notice_id::text);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reward_survey_entry AFTER INSERT ON public.survey_entries FOR EACH ROW EXECUTE FUNCTION public.reward_survey_entry();

-- Program editor saves its choice with the notice in the same transaction.
CREATE FUNCTION public.sync_notice_survey() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE version uuid; form uuid;
BEGIN
 IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
 IF NOT (coalesce(NEW.guest_properties,'{}') ? 'survey_version_id') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.guest_properties->'survey_version_id',NEW.guest_properties->'enable_feedback') IS NOT DISTINCT FROM (OLD.guest_properties->'survey_version_id',OLD.guest_properties->'enable_feedback') THEN RETURN NEW; END IF;
 version := nullif(NEW.guest_properties->>'survey_version_id','')::uuid;
 IF version IS NULL OR NOT coalesce((NEW.guest_properties->>'enable_feedback')::boolean,false) THEN
   UPDATE public.survey_links SET enabled=false WHERE notice_id=NEW.id AND enabled;
 ELSE
   SELECT form_id INTO STRICT form FROM public.survey_versions WHERE id=version;
   UPDATE public.survey_links SET enabled=false WHERE notice_id=NEW.id AND form_id<>form AND enabled;
   IF EXISTS (SELECT 1 FROM public.survey_links WHERE notice_id=NEW.id AND form_id=form) THEN
     UPDATE public.survey_links SET version_id=version,enabled=true WHERE id=(SELECT id FROM public.survey_links WHERE notice_id=NEW.id AND form_id=form ORDER BY created_at DESC LIMIT 1);
   ELSE INSERT INTO public.survey_links(form_id,version_id,event,notice_id) VALUES(form,version,'PROGRAM',NEW.id); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_notice_survey AFTER INSERT OR UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.sync_notice_survey();

CREATE FUNCTION public.guard_survey_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.form_id,NEW.event,NEW.center_code,NEW.notice_id) IS DISTINCT FROM (OLD.form_id,OLD.event,OLD.center_code,OLD.notice_id) THEN
   RAISE EXCEPTION 'Detach and create a new link instead of changing its target';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_survey_link BEFORE UPDATE ON public.survey_links FOR EACH ROW EXECUTE FUNCTION public.guard_survey_link();
CREATE FUNCTION public.sync_survey_link_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()>1 OR NEW.notice_id IS NULL THEN RETURN NEW; END IF;
 UPDATE public.notices SET guest_properties=coalesce(guest_properties,'{}'::jsonb)||jsonb_build_object(
   'survey_version_id',CASE WHEN NEW.enabled THEN NEW.version_id::text ELSE '' END,
   'enable_feedback',NEW.enabled) WHERE id=NEW.notice_id;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_survey_link_notice AFTER INSERT OR UPDATE ON public.survey_links FOR EACH ROW EXECUTE FUNCTION public.sync_survey_link_notice();

ALTER TABLE public.survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_forms_read ON public.survey_forms FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY survey_forms_insert ON public.survey_forms FOR INSERT TO authenticated WITH CHECK (public.is_current_staff());
CREATE POLICY survey_forms_update ON public.survey_forms FOR UPDATE TO authenticated USING (public.is_current_staff()) WITH CHECK (public.is_current_staff());
CREATE POLICY survey_versions_read ON public.survey_versions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY survey_versions_insert ON public.survey_versions FOR INSERT TO authenticated WITH CHECK (public.is_current_staff());
CREATE POLICY survey_links_read ON public.survey_links FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY survey_links_insert ON public.survey_links FOR INSERT TO authenticated WITH CHECK (public.is_current_staff());
CREATE POLICY survey_links_update ON public.survey_links FOR UPDATE TO authenticated USING (public.is_current_staff()) WITH CHECK (public.is_current_staff());
CREATE POLICY survey_entries_read ON public.survey_entries FOR SELECT TO authenticated USING (public.is_current_staff() OR public.is_current_profile(user_id));
CREATE POLICY survey_entries_insert ON public.survey_entries FOR INSERT TO anon,authenticated WITH CHECK (public.survey_can_access_user(user_id));
CREATE POLICY survey_entries_update ON public.survey_entries FOR UPDATE TO authenticated USING (public.survey_can_access_user(user_id)) WITH CHECK (public.survey_can_access_user(user_id));
GRANT SELECT,INSERT,UPDATE ON public.survey_forms,public.survey_links,public.survey_entries TO authenticated;
GRANT SELECT,INSERT ON public.survey_versions TO authenticated;
GRANT SELECT ON public.survey_forms,public.survey_versions,public.survey_links TO anon;
GRANT INSERT ON public.survey_entries TO anon;
-- Only completion flags (never historical answers) are available through a
-- guest receipt when resolving one-time center surveys across visits.
CREATE VIEW public.survey_completions WITH (security_barrier=true) AS
 SELECT DISTINCT link_id,user_id,response_key FROM public.survey_entries
 WHERE notice_id IS NULL AND public.survey_can_access_user(user_id);
GRANT SELECT ON public.survey_completions TO anon,authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='account_merge_worker') THEN
   GRANT SELECT,UPDATE ON public.survey_entries TO account_merge_worker;
   CREATE POLICY survey_entries_merge_read ON public.survey_entries FOR SELECT TO account_merge_worker USING (true);
   CREATE POLICY survey_entries_merge_update ON public.survey_entries FOR UPDATE TO account_merge_worker
     USING (user_id::text=current_setting('app.merge_source_id',true))
     WITH CHECK (user_id::text=current_setting('app.merge_target_id',true));
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
