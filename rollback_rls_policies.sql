-- ====================================================================
-- ROLLBACK SCRIPT FOR RLS POLICIES ON 4 TABLES
-- 
-- Run this script in your Supabase SQL Editor to fully disable RLS
-- and revert the database state to the previous open/unrestricted state.
-- ====================================================================

-- 1. Disable Row Level Security (RLS) on the tables
ALTER TABLE public.visit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hyphen_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hyphen_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders DISABLE ROW LEVEL SECURITY;

-- 2. Drop all policies created for option B (clean up)
DROP POLICY IF EXISTS "Allow public read for visit_notes" ON public.visit_notes;
DROP POLICY IF EXISTS "Allow public insert for visit_notes" ON public.visit_notes;
DROP POLICY IF EXISTS "Allow public update for visit_notes" ON public.visit_notes;
DROP POLICY IF EXISTS "Allow delete for admin only" ON public.visit_notes;

DROP POLICY IF EXISTS "Allow public select for hyphen_items" ON public.hyphen_items;
DROP POLICY IF EXISTS "Allow manage for admin only" ON public.hyphen_items;

DROP POLICY IF EXISTS "Allow select for self and admin" ON public.hyphen_transactions;
DROP POLICY IF EXISTS "Allow public insert for transactions" ON public.hyphen_transactions;
DROP POLICY IF EXISTS "Allow delete for admin only" ON public.hyphen_transactions;

DROP POLICY IF EXISTS "Allow select for self and admin" ON public.store_orders;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.store_orders;
DROP POLICY IF EXISTS "Allow manage for admin only" ON public.store_orders;
