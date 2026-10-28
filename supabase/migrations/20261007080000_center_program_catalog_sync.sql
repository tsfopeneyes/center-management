BEGIN;
-- Only public program metadata is copied; narrative content and hosts are excluded.
CREATE FUNCTION center_integration.sync_program_catalog() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE center_integration.program_catalog SET published=false,updated_at=now() WHERE program_ref=OLD.id::text;
    RETURN OLD;
  END IF;
  IF NEW.category='PROGRAM' AND NEW.is_private IS NOT TRUE AND NEW.is_leader_only IS NOT TRUE
     AND NEW.program_status IS DISTINCT FROM 'CANCELLED' AND length(trim(NEW.title)) BETWEEN 1 AND 200 THEN
    INSERT INTO center_integration.program_catalog(program_ref,title,scheduled_date,recruitment_status,public_description,published)
    VALUES(NEW.id::text,trim(NEW.title),(NEW.program_date AT TIME ZONE 'Asia/Seoul')::date,
      CASE WHEN NEW.program_status='COMPLETED' OR NEW.is_recruiting=false THEN 'closed'
           WHEN NEW.is_recruiting=true THEN 'open' ELSE 'unknown' END,NULL,true)
    ON CONFLICT(program_ref) DO UPDATE SET title=EXCLUDED.title,scheduled_date=EXCLUDED.scheduled_date,
      recruitment_status=EXCLUDED.recruitment_status,public_description=NULL,published=true,updated_at=now();
  ELSE
    UPDATE center_integration.program_catalog SET published=false,updated_at=now() WHERE program_ref=NEW.id::text;
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION center_integration.sync_program_catalog() FROM PUBLIC,anon,authenticated,center_integration_token;
CREATE TRIGGER center_program_catalog_sync AFTER INSERT OR UPDATE OR DELETE ON public.notices
FOR EACH ROW EXECUTE FUNCTION center_integration.sync_program_catalog();
INSERT INTO center_integration.program_catalog(program_ref,title,scheduled_date,recruitment_status,public_description,published)
SELECT id::text,trim(title),(program_date AT TIME ZONE 'Asia/Seoul')::date,
CASE WHEN program_status='COMPLETED' OR is_recruiting=false THEN 'closed' WHEN is_recruiting=true THEN 'open' ELSE 'unknown' END,NULL,true
FROM public.notices WHERE category='PROGRAM' AND is_private IS NOT TRUE AND is_leader_only IS NOT TRUE
AND program_status IS DISTINCT FROM 'CANCELLED' AND length(trim(title)) BETWEEN 1 AND 200
ON CONFLICT(program_ref) DO UPDATE SET title=EXCLUDED.title,scheduled_date=EXCLUDED.scheduled_date,
 recruitment_status=EXCLUDED.recruitment_status,public_description=NULL,published=true,updated_at=now();
COMMIT;
