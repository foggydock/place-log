-- ============================================================
-- 行った場所ノート スキーマ v1
-- Supabase の SQL Editor に「全文コピペ」して実行してください。
-- （people-map / history-db / 動画ウォッチ箱と同じ Sou_Diary プロジェクトに
--   間借りしますが、この plog_ テーブルは他アプリのテーブルと混ざりません）
--
-- 【最重要・プライバシー】
--   このプロジェクトには他の人のアカウント（例：奥様）も居ます。
--   行った場所ノートは「自分のデータは自分(user_id = auth.uid())だけ」に隔離します。
--   ＝ 他のアカウントからは岡野さんの訪問記録は一切見えません。
-- ============================================================

-- 場所（1つの店＝1行。何度行っても行は増えない）
create table if not exists public.plog_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,                       -- 場所の名前（必須・手入力）
  genre       text default '',                     -- ジャンル（自分の言葉で自由に）
  area        text default '',                     -- エリア（例：江古田、金沢）
  address     text default '',                     -- 住所やメモ書きの場所情報
  lat         double precision,                    -- 緯度（GPSで取得 or 空）
  lng         double precision,                    -- 経度（GPSで取得 or 空）
  tags        text[] default '{}',                 -- 自由タグ（静か、子連れOK など）
  stars       int default 0,                       -- よかった度（0〜5）
  revisit     int default 0,                       -- また行きたい度（0=未設定,1=ない,2=あり,3=絶対また行く）
  note        text default '',                     -- その場所についてのメモ
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_plog_places_user on public.plog_places (user_id);

-- 訪問（1回行くたびに1行。同じ場所のカードに積まれていく）
create table if not exists public.plog_visits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id    uuid not null references public.plog_places(id) on delete cascade,
  visited_on  date not null default current_date,  -- 訪問日
  memo        text default '',                     -- その日のひとこと
  created_at  timestamptz not null default now()
);

create index if not exists idx_plog_visits_user  on public.plog_visits (user_id);
create index if not exists idx_plog_visits_place on public.plog_visits (place_id, visited_on desc);

-- ============================================================
-- updated_at 自動更新トリガー
-- （Sou_Diary に同名関数が既にあっても create or replace なので安全）
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_plog_places_updated_at on public.plog_places;
create trigger trg_plog_places_updated_at
  before update on public.plog_places
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS（行レベルセキュリティ）：自分の行だけ読み書きできる
-- ============================================================
alter table public.plog_places enable row level security;
alter table public.plog_visits enable row level security;

drop policy if exists plog_places_select on public.plog_places;
drop policy if exists plog_places_write  on public.plog_places;

create policy plog_places_select on public.plog_places
  for select using (user_id = auth.uid());
create policy plog_places_write on public.plog_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists plog_visits_select on public.plog_visits;
drop policy if exists plog_visits_write  on public.plog_visits;

create policy plog_visits_select on public.plog_visits
  for select using (user_id = auth.uid());
create policy plog_visits_write on public.plog_visits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- GRANT（RLSだけでは足りない。ログインユーザーのロールに権限を渡す）
-- ============================================================
grant select, insert, update, delete on public.plog_places to authenticated;
grant select, insert, update, delete on public.plog_visits to authenticated;
