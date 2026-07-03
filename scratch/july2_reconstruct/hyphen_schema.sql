-- 1. hyphen_items (하이픈 스토어 소모품 & 추가 적립 항목 통합 테이블)
CREATE TABLE IF NOT EXISTS public.hyphen_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    amount INTEGER NOT NULL, -- 적립 시에는 양수, 소모 시에도 일단 절대값으로 적어두고 쓸 수 있음
    item_type TEXT NOT NULL DEFAULT 'SPEND', -- 'EARN' (적립 항목) 또는 'SPEND' (소모품)
    requires_approval BOOLEAN DEFAULT false,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. hyphen_transactions (하이픈 증감 내역 테이블)
CREATE TABLE IF NOT EXISTS public.hyphen_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- 획득은 양수(+), 사용은 음수(-)
    transaction_type TEXT NOT NULL, -- 'EARN', 'SPEND', 'RESET', 'MANUAL'
    source_description TEXT, -- ex) '공간 체류 2시간', '물품 구매: 아메리카노', '직접 지급: 친구초대'
    item_id UUID REFERENCES public.hyphen_items(id), -- 연관된 아이템(옵션)
    admin_id UUID, -- 수동 지급 시 관리자 ID 기록 (명성추적용)
    semester TEXT, -- ex) '2026-1'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. store_orders (스토어 구매 내역 및 승인 요청 테이블)
CREATE TABLE IF NOT EXISTS public.store_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.hyphen_items(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- 구매 당시의 가격 기록 (나중에 가격이 변동될 수 있으므로)
    status TEXT NOT NULL, -- 'COMPLETED'(즉시완료), 'PENDING'(승인대기), 'APPROVED'(승인됨), 'REJECTED'(반려됨)
    admin_id UUID, -- 승인/반려 처리한 관리자 ID
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 4. 기존 테이블 확장 (users, notices)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_hyphen INTEGER DEFAULT 0;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS hyphen_reward INTEGER DEFAULT 0;

-- 5. 하이픈 잔액(current_hyphen) 자동 동기화 트리거
-- transactions 테이블에 내역이 생기거나 지워지면 users 테이블의 current_hyphen이 자동으로 변동되게 만듭니다.
CREATE OR REPLACE FUNCTION update_user_hyphen_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.users
        SET current_hyphen = current_hyphen + NEW.amount
        WHERE id = NEW.user_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.users
        SET current_hyphen = current_hyphen - OLD.amount
        WHERE id = OLD.user_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.users
        SET current_hyphen = current_hyphen - OLD.amount + NEW.amount
        WHERE id = NEW.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_hyphen ON public.hyphen_transactions;
CREATE TRIGGER trg_update_user_hyphen
AFTER INSERT OR UPDATE OR DELETE ON public.hyphen_transactions
FOR EACH ROW EXECUTE FUNCTION update_user_hyphen_balance();

-- 6. 하이픈 항목 기본 데이터 세팅
INSERT INTO public.hyphen_items (name, amount, item_type, requires_approval, is_active)
VALUES 
('음료', 1, 'SPEND', false, true),
('인생네컷', 5, 'SPEND', false, true),
('VIP 라운지', 20, 'SPEND', true, true),
('대표님 식사권', 50, 'SPEND', true, true),
('친구 초대 수고', 5, 'EARN', false, true),
('스쿨처치 창립', 30, 'EARN', false, true)
ON CONFLICT DO NOTHING;

-- 권한(RLS) 임시 개방 (필요에 따라 차후 제한할 수 있습니다)
ALTER TABLE public.hyphen_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hyphen_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders DISABLE ROW LEVEL SECURITY;
