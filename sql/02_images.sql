-- ============================================================
-- 行った場所ノート：画像添付（名刺・写真など）
-- Supabase の SQL Editor に「全文コピペ」して実行してください。
-- 01_schema.sql を実行済みであることが前提です。
-- ============================================================

-- 画像はプライベートな Storage バケットに置き、
-- どのファイルがどの場所のものかを紐付けるテーブルだけ public スキーマに作る。
create table if not exists public.plog_images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id      uuid not null references public.plog_places(id) on delete cascade,
  storage_path  text not null,                     -- Storage 内のパス（{user_id}/{place_id}/{ファイル名}）
  caption       text default '',                   -- 任意のひとこと（例：もらった名刺）
  created_at    timestamptz not null default now()
);

create index if not exists idx_plog_images_place on public.plog_images (place_id, created_at desc);

alter table public.plog_images enable row level security;

drop policy if exists plog_images_select on public.plog_images;
drop policy if exists plog_images_write  on public.plog_images;

create policy plog_images_select on public.plog_images
  for select using (user_id = auth.uid());
create policy plog_images_write on public.plog_images
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.plog_images to authenticated;

-- ============================================================
-- Storage バケット（非公開。signed URL でのみ閲覧できる）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('plog-images', 'plog-images', false)
on conflict (id) do nothing;

drop policy if exists plog_images_storage_select on storage.objects;
drop policy if exists plog_images_storage_insert on storage.objects;
drop policy if exists plog_images_storage_delete on storage.objects;

-- パスの先頭フォルダを自分の user_id にしておき、それだけを許可する
create policy plog_images_storage_select on storage.objects
  for select using (
    bucket_id = 'plog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy plog_images_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'plog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy plog_images_storage_delete on storage.objects
  for delete using (
    bucket_id = 'plog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
