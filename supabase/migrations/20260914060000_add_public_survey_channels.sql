-- Add standalone, signed-in survey links without weakening visit/program checks.
-- Existing links and responses remain untouched.
BEGIN;

ALTER TABLE public.survey_links
  ADD COLUMN IF NOT EXISTS public_token uuid;

ALTER TABLE public.survey_links DROP CONSTRAINT IF EXISTS survey_links_event_check;
ALTER TABLE public.survey_links
  ADD CONSTRAINT survey_links_event_check
  CHECK (event IN ('CHECKIN','CHECKOUT','PROGRAM','PUBLIC'));

ALTER TABLE public.survey_links DROP CONSTRAINT IF EXISTS survey_links_check;
ALTER TABLE public.survey_links DROP CONSTRAINT IF EXISTS survey_links_target_check;
ALTER TABLE public.survey_links
  ADD CONSTRAINT survey_links_target_check CHECK (
    (event = 'PROGRAM' AND notice_id IS NOT NULL AND center_code IS NULL AND public_token IS NULL AND frequency = 'ONCE') OR
    (event IN ('CHECKIN','CHECKOUT') AND notice_id IS NULL AND center_code IS NOT NULL AND public_token IS NULL) OR
    (event = 'PUBLIC' AND notice_id IS NULL AND center_code IS NULL AND public_token IS NOT NULL AND frequency = 'ONCE')
  );

CREATE UNIQUE INDEX IF NOT EXISTS survey_public_token_unique
  ON public.survey_links(public_token)
  WHERE public_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS survey_one_public_link_per_form
  ON public.survey_links(form_id)
  WHERE enabled AND event = 'PUBLIC';

CREATE OR REPLACE FUNCTION public.guard_survey_entry() RETURNS trigger
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
 IF EXISTS (SELECT 1 FROM public.survey_forms WHERE id=link.form_id AND kind='TEMPLATE') THEN RAISE EXCEPTION 'Templates cannot collect responses'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF link.event NOT IN ('PROGRAM','PUBLIC') THEN RAISE EXCEPTION 'Visit responses cannot be edited'; END IF;
   IF (to_jsonb(NEW)-'answers'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'answers'-'updated_at') THEN RAISE EXCEPTION 'Response identity is immutable'; END IF;
   definition := OLD.snapshot;
 ELSE
   IF NEW.version_id IS NOT NULL AND NEW.version_id <> link.version_id THEN RAISE EXCEPTION 'Questions changed. Reopen the survey before submitting'; END IF;
   SELECT sv.definition INTO STRICT definition FROM public.survey_versions sv WHERE sv.id=link.version_id;
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
 ELSIF link.event = 'PUBLIC' THEN
   IF auth.uid() IS NULL AND NOT public.is_current_staff() THEN RAISE EXCEPTION 'Sign in to answer shared surveys'; END IF;
   NEW.response_key := 'ONCE'; NEW.visit_id := NULL; NEW.location_id := NULL; NEW.notice_id := NULL;
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

CREATE OR REPLACE FUNCTION public.guard_survey_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE form_kind text;
BEGIN
 SELECT kind INTO form_kind FROM public.survey_forms WHERE id=NEW.form_id;
 IF form_kind='TEMPLATE' THEN RAISE EXCEPTION 'Templates cannot be connected or shared'; END IF;
 IF TG_OP='UPDATE' AND (NEW.form_id,NEW.event,NEW.center_code,NEW.notice_id,NEW.public_token) IS DISTINCT FROM (OLD.form_id,OLD.event,OLD.center_code,OLD.notice_id,OLD.public_token) THEN
   RAISE EXCEPTION 'Detach and create a new link instead of changing its target';
 END IF;
 RETURN NEW;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
