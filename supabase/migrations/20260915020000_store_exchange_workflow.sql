-- Staff-facing store exchange workflow.
-- The read RPC avoids exposing every student's orders through broad table RLS,
-- while the completion RPC commits the order state and point transaction atomically.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_store_exchange_orders()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT CASE
        WHEN NOT public.is_current_staff() THEN
            (SELECT jsonb_build_object('error', 'staff_access_required'))
        ELSE coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', orders.id,
                'user_id', orders.user_id,
                'item_id', orders.item_id,
                'amount', orders.amount,
                'status', orders.status,
                'admin_id', orders.admin_id,
                'created_at', orders.created_at,
                'completed_at', orders.completed_at,
                'users', jsonb_build_object('name', users.name, 'school', users.school),
                'haifn_items', jsonb_build_object(
                    'name', items.name,
                    'image_url', items.image_url,
                    'category', items.category,
                    'requires_approval', items.requires_approval
                )
            ) ORDER BY orders.created_at DESC)
            FROM public.store_orders AS orders
            LEFT JOIN public.users AS users ON users.id = orders.user_id
            LEFT JOIN public.haifn_items AS items ON items.id = orders.item_id
        ), '[]'::jsonb)
    END;
$$;

REVOKE ALL ON FUNCTION public.get_store_exchange_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_exchange_orders() TO authenticated, service_role;

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
    item_name text;
    item_type text;
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

    SELECT name, coalesce(item_type, 'SPEND')
    INTO item_name, item_type
    FROM public.haifn_items
    WHERE id = target_order.item_id;

    IF p_approved THEN
        IF item_type = 'SPEND' THEN
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
            CASE WHEN item_type = 'EARN' THEN abs(target_order.amount) ELSE -abs(target_order.amount) END,
            CASE WHEN item_type = 'EARN' THEN 'EARN' ELSE 'SPEND' END,
            CASE WHEN item_type = 'EARN' THEN '[스토어 적립] ' ELSE '[스토어 교환] ' END || coalesce(item_name, '삭제된 상품'),
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

REVOKE ALL ON FUNCTION public.complete_store_exchange(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_store_exchange(uuid, boolean) TO authenticated, service_role;

-- Direct-table fallbacks remain available only to the verified owner or staff.
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.store_orders TO authenticated;

DROP POLICY IF EXISTS store_orders_authenticated_read ON public.store_orders;
CREATE POLICY store_orders_authenticated_read ON public.store_orders
FOR SELECT TO authenticated
USING (public.is_current_staff() OR public.is_current_profile(user_id));

DROP POLICY IF EXISTS store_orders_owner_insert ON public.store_orders;
CREATE POLICY store_orders_owner_insert ON public.store_orders
FOR INSERT TO authenticated
WITH CHECK (public.is_current_profile(user_id));

DROP POLICY IF EXISTS store_orders_staff_update ON public.store_orders;
CREATE POLICY store_orders_staff_update ON public.store_orders
FOR UPDATE TO authenticated
USING (public.is_current_staff())
WITH CHECK (public.is_current_staff());

NOTIFY pgrst, 'reload schema';
COMMIT;
