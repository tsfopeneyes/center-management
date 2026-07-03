-- Supabase SQL Editor용 마이그레이션 스크립트
-- 기존의 챌린지 관련 테이블명을 뱃지(Badge) 테이블명으로 안전하게 변경합니다.

-- 1. 테이블 이름 변경
ALTER TABLE IF EXISTS public.challenge_categories RENAME TO badge_categories;
ALTER TABLE IF EXISTS public.challenges RENAME TO badges;
ALTER TABLE IF EXISTS public.user_challenges RENAME TO user_badges;

-- 2. 외래 키 제약 조건 및 인덱스 이름 교정을 원할 경우 하위 쿼리도 함께 적용 가능합니다.
-- (PostgREST API 쿼리 상으로는 테이블명만 badge_categories, badges, user_badges로 맞추면 즉시 정상 작동합니다.)

-- 3. 테이블 설명 주석
COMMENT ON TABLE public.badge_categories IS '뱃지 분류 카테고리 테이블';
COMMENT ON TABLE public.badges IS '학생들이 획득 가능한 뱃지 목록 테이블';
COMMENT ON TABLE public.user_badges IS '학생별로 수동/자동 수여된 뱃지 매핑 테이블';
