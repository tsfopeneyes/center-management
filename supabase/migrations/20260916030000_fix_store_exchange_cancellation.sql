-- Fix the ambiguous item_type reference and let students cancel their own
-- pending exchange requests before staff completes them.
BEGIN;

CREATE OR REPLACE FUNCTION public.complete_store_exchange(
    p_order_id uuid,
    p_approved boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_order public.store_orders%ROWTYPE;
    actor_profile_id uuid;
    target_item_name text;
    target_item_type text;
    resulting_balance integer;
BEGIN
    IF NOT public.is_current_staff() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;

    actor_profile_id := public.current_profile_id();

    SELECT * INTO target_order
    FROM public.store_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '교환 신청을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
    END IF;

    IF target_order.status <> 'PENDING' THEN
        RAISE EXCEPTION '이미 처리된 교환 신청입니다.' USING ERRCODE = 'P0001';
    END IF;

    SELECT items.name, coalesce(items.item_type, 'SPEND')
    INTO target_item_name, target_item_type
    FROM public.haifn_items AS items
    WHERE items.id = target_order.item_id;

    IF p_approved THEN
        IF target_item_type = 'SPEND' THEN
            SELECT current_haifn INTO resulting_balance
            FROM public.users
            WHERE id = target_order.user_id
            FOR UPDATE;

            IF coalesce(resulting_balance, 0) < abs(target_order.amount) THEN
                RAISE EXCEPTION '학생의 하이픈이 부족합니다.' USING ERRCODE = 'P0001';
            END IF;
        END IF;

        INSERT INTO public.haifn_transactions(
            user_id, amount, transaction_type, source_description, admin_id
        ) VALUES (
            target_order.user_id,
            CASE WHEN target_item_type = 'EARN' THEN abs(target_order.amount) ELSE -abs(target_order.amount) END,
            CASE WHEN target_item_type = 'EARN' THEN 'EARN' ELSE 'SPEND' END,
            CASE WHEN target_item_type = 'EARN' THEN '[스토어 적립] ' ELSE '[스토어 교환] ' END || coalesce(target_item_name, '삭제된 상품'),
            actor_profile_id
        );
    END IF;

    UPDATE public.store_orders
    SET status = CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END,
        admin_id = actor_profile_id,
        completed_at = clock_timestamp()
    WHERE id = target_order.id;

    SELECT current_haifn INTO resulting_balance
    FROM public.users
    WHERE id = target_order.user_id;

    RETURN jsonb_build_object(
        'id', target_order.id,
        'user_id', target_order.user_id,
        'status', CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END,
        'current_haifn', resulting_balance
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_own_store_exchange(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_order public.store_orders%ROWTYPE;
BEGIN
    SELECT * INTO target_order
    FROM public.store_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '교환 신청을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.is_current_profile(target_order.user_id) THEN
        RAISE EXCEPTION '본인의 교환 신청만 취소할 수 있습니다.' USING ERRCODE = '42501';
    END IF;

    IF target_order.status <> 'PENDING' THEN
        RAISE EXCEPTION '이미 처리되었거나 취소된 교환 신청입니다.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.store_orders
    SET status = 'REJECTED', completed_at = clock_timestamp()
    WHERE id = target_order.id;

    RETURN jsonb_build_object('id', target_order.id, 'status', 'REJECTED');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_store_exchange(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_store_exchange(uuid) TO authenticated, service_role;

-- Direct-table fallback used when PostgREST has not reloaded the new RPC yet.
DROP POLICY IF EXISTS store_orders_owner_cancel_pending ON public.store_orders;
CREATE POLICY store_orders_owner_cancel_pending
ON public.store_orders
FOR UPDATE TO authenticated
USING (public.is_current_profile(user_id) AND status = 'PENDING')
WITH CHECK (public.is_current_profile(user_id) AND status = 'REJECTED');

NOTIFY pgrst, 'reload schema';
COMMIT;
