-- A legacy delete attempt could remove the ledger entry first and then be
-- blocked by store_orders RLS, leaving an approved order with no transaction.
-- Such an orphan has no remaining balance mutation to reverse, so allow staff
-- to remove the order while reporting that no additional points were restored.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_store_exchange_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_order public.store_orders%ROWTYPE;
    target_item_name text;
    target_item_type text;
    target_transaction_id uuid;
    should_restore_points boolean;
    did_restore_points boolean := false;
BEGIN
    IF NOT public.is_current_staff() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO target_order
    FROM public.store_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '삭제할 주문 내역을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
    END IF;

    should_restore_points := target_order.status NOT IN ('PENDING', 'REJECTED');

    IF should_restore_points THEN
        SELECT items.name, coalesce(items.item_type, 'SPEND')
        INTO target_item_name, target_item_type
        FROM public.haifn_items AS items
        WHERE items.id = target_order.item_id;

        SELECT transactions.id INTO target_transaction_id
        FROM public.haifn_transactions AS transactions
        WHERE transactions.user_id = target_order.user_id
          AND transactions.transaction_type = CASE WHEN target_item_type = 'EARN' THEN 'EARN' ELSE 'SPEND' END
          AND transactions.amount = CASE WHEN target_item_type = 'EARN' THEN abs(target_order.amount) ELSE -abs(target_order.amount) END
          AND transactions.source_description =
              CASE WHEN target_item_type = 'EARN' THEN '[스토어 적립] ' ELSE '[스토어 교환] ' END
              || coalesce(target_item_name, '삭제된 상품')
        ORDER BY abs(extract(epoch FROM (
            transactions.created_at - coalesce(target_order.completed_at, target_order.created_at)
        )))
        LIMIT 1
        FOR UPDATE;

        IF target_transaction_id IS NOT NULL THEN
            DELETE FROM public.haifn_transactions
            WHERE id = target_transaction_id;
            did_restore_points := true;
        END IF;
    END IF;

    DELETE FROM public.store_orders
    WHERE id = target_order.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '주문 내역이 삭제되지 않았습니다.' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
        'id', target_order.id,
        'deleted', true,
        'points_restored', did_restore_points,
        'orphaned_order', should_restore_points AND NOT did_restore_points
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
