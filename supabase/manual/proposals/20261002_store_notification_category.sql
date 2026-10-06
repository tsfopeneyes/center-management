-- Review before production execution. No order, point or log rows are modified.
BEGIN;
ALTER TABLE public.notification_delivery_logs
  DROP CONSTRAINT notification_delivery_logs_category_check;
ALTER TABLE public.notification_delivery_logs
  ADD CONSTRAINT notification_delivery_logs_category_check
  CHECK (category IN ('visit', 'program', 'coffee_chat', 'rental', 'store'));
COMMIT;
