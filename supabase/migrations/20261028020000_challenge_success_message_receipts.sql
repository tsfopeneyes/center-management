-- UI receipts only: no changes to challenge progress, settings or rewards.
CREATE TABLE public.challenge_success_message_receipts (
    challenge_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shown_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (challenge_id, user_id)
);
ALTER TABLE public.challenge_success_message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY challenge_success_receipts_select ON public.challenge_success_message_receipts
    FOR SELECT TO anon, authenticated USING (public.is_current_profile(user_id));
CREATE POLICY challenge_success_receipts_insert ON public.challenge_success_message_receipts
    FOR INSERT TO anon, authenticated WITH CHECK (
        public.is_current_profile(user_id) AND EXISTS (
            SELECT 1 FROM public.notice_responses r JOIN public.notices n ON n.id = r.notice_id
            WHERE r.notice_id = challenge_success_message_receipts.challenge_id
              AND r.user_id = challenge_success_message_receipts.user_id
              AND r.status = 'JOIN' AND n.is_challenge
        )
    );
GRANT SELECT, INSERT ON public.challenge_success_message_receipts TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
