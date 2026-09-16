ALTER TABLE public.haifn_items
ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.haifn_items.description IS '하이픈 스토어 상품 상세 설명';

