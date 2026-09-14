-- Deleting a notice preserves its notification history by setting notice_id to
-- NULL. That FK action also runs this validation trigger, so it must explicitly
-- allow the database-managed unlink while continuing to reject malformed new
-- application notifications.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.set_notice_notification_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    notice_regions text[];
    latest_application_content text;
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.notice_id IS NOT NULL
       AND NEW.notice_id IS NULL THEN
        NEW.is_hidden := true;
        NEW.is_current_application_state := false;
        RETURN NEW;
    END IF;

    IF NEW.notification_type = 'APPLICATION' THEN
        IF NEW.sender_id IS NULL OR NEW.notice_id IS NULL THEN
            RAISE EXCEPTION 'Application notifications require applicant and program identities';
        END IF;

        NEW.target_group := 'USER_' || NEW.sender_id::text;

        IF TG_OP = 'INSERT' THEN
            SELECT content
            INTO latest_application_content
            FROM public.app_notifications
            WHERE notification_type = 'APPLICATION'
              AND sender_id = NEW.sender_id
              AND notice_id = NEW.notice_id
              AND is_current_application_state = true
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            FOR UPDATE;

            IF FOUND AND latest_application_content = NEW.content THEN
                RETURN NULL;
            END IF;

            UPDATE public.app_notifications
            SET is_current_application_state = false
            WHERE notification_type = 'APPLICATION'
              AND sender_id = NEW.sender_id
              AND notice_id = NEW.notice_id
              AND is_current_application_state = true;

            NEW.is_current_application_state := true;
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.notice_id IS NULL OR NEW.notification_type <> 'NOTICE' THEN
        RETURN NEW;
    END IF;

    SELECT target_regions
    INTO notice_regions
    FROM public.notices
    WHERE id = NEW.notice_id;

    NEW.target_group := CASE
        WHEN array_length(notice_regions, 1) = 1 THEN 'REGION_' || notice_regions[1]
        ELSE '전체'
    END;

    IF TG_OP = 'INSERT' AND EXISTS (
        SELECT 1
        FROM public.app_notifications AS existing
        WHERE existing.notification_type = 'NOTICE'
          AND existing.notice_id = NEW.notice_id
          AND existing.target_group = NEW.target_group
          AND existing.content = NEW.content
          AND existing.created_at >= now() - interval '5 minutes'
    ) THEN
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
