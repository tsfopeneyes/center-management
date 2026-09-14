-- Central external-notification audit and idempotency ledger.
-- This table contains no provider tokens, webhook URLs, or message bodies.
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  source_table text NOT NULL,
  source_id text NOT NULL,
  center_code text NOT NULL CHECK (center_code IN ('HAIFN', 'ENOUGH_PLACE')),
  category text NOT NULL CHECK (category IN ('visit', 'program', 'coffee_chat', 'rental')),
  channel text NOT NULL CHECK (channel IN ('line', 'slack')),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (event_key, center_code, channel)
);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_created_at_idx
  ON public.notification_delivery_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_failed_idx
  ON public.notification_delivery_logs (status, updated_at DESC)
  WHERE status = 'failed';

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

-- External notification delivery is server-only. The service role bypasses RLS;
-- no browser role receives direct table access.
REVOKE ALL ON TABLE public.notification_delivery_logs FROM anon, authenticated;

-- Non-secret routing switches. Existing category-wide switches remain the
-- master controls; this matrix narrows delivery by center and channel.
INSERT INTO public.global_settings (key, value)
VALUES (
  'notification_routing_config',
  '{"HAIFN":{"line":{"visit":true,"program":true,"coffee_chat":true,"rental":false},"slack":{"visit":true,"program":true,"coffee_chat":true,"rental":true}},"ENOUGH_PLACE":{"line":{"visit":true,"program":true,"coffee_chat":true,"rental":false},"slack":{"visit":false,"program":false,"coffee_chat":false,"rental":false}}}'
)
ON CONFLICT (key) DO NOTHING;
