-- 直観メシ: アカウントごとに保存するデータ
-- Supabase の SQL Editor で実行してください（このリポジトリからは実行しません）。
-- 何度実行しても大丈夫なように、ルール(policy)は「あれば消してから作る」ようにしています。
--
-- 方針
-- - お店の情報（名前・写真など）は保存しない。Google の place ID だけを持ち、
--   表示のたびに /api/stores/lookup で取り直す（Google の規約でも place ID 以外の長期保存は不可）。
-- - パス回数・初回説明の表示済みフラグは端末ごとで十分なので localStorage のまま。
-- - 名前・検索設定は Supabase Auth の user_metadata に保存済みなのでテーブルは作らない。

-- ─────────────────────────────────────────────
-- 1. favorites: 食べたいリスト（はずすと消える）
-- ─────────────────────────────────────────────
create table if not exists public.favorites (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  place_id   text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)  -- 同じ店を2回登録できない
);

-- 一覧は「新しく追加した順」で出すので、その並びの索引
create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

drop policy if exists "favorites: 自分の分だけ見られる" on public.favorites;
create policy "favorites: 自分の分だけ見られる"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "favorites: 自分の分だけ追加できる" on public.favorites;
create policy "favorites: 自分の分だけ追加できる"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "favorites: 自分の分だけ消せる" on public.favorites;
create policy "favorites: 自分の分だけ消せる"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. like_history: 右スワイプした記録（追記のみ）
--    同じ店を何度いいねしても1行ずつ残る。
--    画面に出すのは直近7日・最大30件（アプリ側で絞る）。
-- ─────────────────────────────────────────────
create table if not exists public.like_history (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  place_id text        not null,
  liked_at timestamptz not null default now()
);

create index if not exists like_history_user_liked_idx
  on public.like_history (user_id, liked_at desc);

alter table public.like_history enable row level security;

drop policy if exists "like_history: 自分の分だけ見られる" on public.like_history;
create policy "like_history: 自分の分だけ見られる"
  on public.like_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "like_history: 自分の分だけ追加できる" on public.like_history;
create policy "like_history: 自分の分だけ追加できる"
  on public.like_history for insert to authenticated
  with check (auth.uid() = user_id);

-- 古い記録の掃除用（アプリから「7日より前は消す」を実行できるように）
drop policy if exists "like_history: 自分の分だけ消せる" on public.like_history;
create policy "like_history: 自分の分だけ消せる"
  on public.like_history for delete to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. no_website_places: Google にホームページが登録されていなかったお店
--    Google の規約で保存してよいのは place ID だけなので、店名・電話番号は入れない。
--    店名などを見たいときは place ID で Google から取り直す。
--    アプリ(サーバー)が検索のたびに自動で追加する。中身は Supabase の画面で見る想定なので、
--    アプリからの読み取りは許可しない。
-- ─────────────────────────────────────────────
create table if not exists public.no_website_places (
  place_id      text        primary key check (place_id ~ '^[A-Za-z0-9_-]{10,300}$'),
  first_seen_at timestamptz not null default now()
);

alter table public.no_website_places enable row level security;

drop policy if exists "no_website_places: ログイン中なら追加できる" on public.no_website_places;
create policy "no_website_places: ログイン中なら追加できる"
  on public.no_website_places for insert to authenticated
  with check (true);
