-- ============================================================
-- 行った場所ノート：ジャンルを配列型に変更（tags と同じ形式に統一）
-- Supabase の SQL Editor に「全文コピペ」して実行してください。
-- 01_schema.sql（〜03_url.sql）を実行済みであることが前提です。
--
-- 【背景】
--   ジャンルは今まで text（"うどん, カフェ" のようなカンマ区切り文字列）
--   で持っていたため、絞り込み・チップ表示・保存のたびに分解処理が
--   必要で、片方だけ直すとズレが残るバグが起きていた。
--   tags と同じ text[] に揃え、この種のズレを構造的になくす。
-- ============================================================

alter table public.plog_places
  add column if not exists genre_new text[] default '{}';

-- 既存の "うどん, カフェ" / "うどん、カフェ" を1要素ずつに分解して移す
update public.plog_places
set genre_new = (
  select coalesce(array_agg(trim(g)) filter (where trim(g) <> ''), '{}')
  from unnest(regexp_split_to_array(genre, '[,、]')) as g
)
where genre is not null and genre <> '';

alter table public.plog_places drop column genre;
alter table public.plog_places rename column genre_new to genre;
