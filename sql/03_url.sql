-- ============================================================
-- 行った場所ノート：URL列の追加（食べログ・公式サイトなど）
-- Supabase の SQL Editor に「全文コピペ」して実行してください。
-- 01_schema.sql を実行済みであることが前提です。
-- ============================================================

alter table public.plog_places
  add column if not exists url text default '';
