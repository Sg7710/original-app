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

-- ─────────────────────────────────────────────
-- 4. polls: 「リスト」の店から作る投票(LINEの投票のようにURLで共有してみんなで決める)
--    - 作れるのはログイン中の人だけ。候補は place ID で2〜6軒。
--    - 締め切りは作った人が「終わる」を押すまで。開きっぱなしで Google の料金が
--      使われ続けないよう、3日たったら自動で終わる(closes_at)。
--    - 投票する友達はログインなしなので、テーブルは誰にも直接は読ませない。
--      投票IDを知っている人が、その1件だけを get_poll() で読める(ほかの投票は見えない)。
-- ─────────────────────────────────────────────
create table if not exists public.polls (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title      text        not null check (char_length(title) between 1 and 40),
  place_ids  text[]      not null check (array_length(place_ids, 1) between 2 and 6),
  created_at timestamptz not null default now(),
  closes_at  timestamptz not null default now() + interval '3 days',
  closed_at  timestamptz
);

create index if not exists polls_owner_created_idx
  on public.polls (owner_id, created_at desc);

alter table public.polls enable row level security;

drop policy if exists "polls: 自分の投票だけ見られる" on public.polls;
create policy "polls: 自分の投票だけ見られる"
  on public.polls for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "polls: 自分の投票として作れる" on public.polls;
create policy "polls: 自分の投票として作れる"
  on public.polls for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "polls: 自分の投票だけ終われる" on public.polls;
create policy "polls: 自分の投票だけ終われる"
  on public.polls for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 投票ページ用の get_poll() は、決まった店などの列を足した「7.」で作る。

-- ─────────────────────────────────────────────
-- 5. テーブルを使う許可(GRANT)
--    上の RLS ルール(「自分の分だけ」など)は「どの行を」を決めるもので、その前に
--    「このテーブルを使ってよいか」の許可が要る。新しい Supabase プロジェクトは SQL で作った
--    テーブルにこの許可を自動では付けないので、ここでログイン中の人(authenticated)に
--    必要な分だけ付ける。ログインしていない人(anon)には付けない(投票ページは get_poll だけ)。
-- ─────────────────────────────────────────────
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.like_history to authenticated;
grant insert on public.no_website_places to authenticated;
grant select, insert, update on public.polls to authenticated;

-- ─────────────────────────────────────────────
-- 6. poll_votes: 投票ページでのスワイプ(右=行きたい / 左=パス)
--    - 投票する友達はログインなしなので、端末ごとのランダムなID(voter_key)で人を区別する。
--      締め切りまでは同じ voter_key で何度でもやり直せる(上書き)。
--    - テーブルは誰にも直接読み書きさせない。cast_votes() で投票し、
--      get_poll_results() で結果を見る。結果を返すのは、その投票にもう投票した人と作った人だけ
--      (先に他の人の票を見てつられないように)。終わった投票は誰でも見られる。
-- ─────────────────────────────────────────────
create table if not exists public.poll_votes (
  poll_id    uuid        not null references public.polls (id) on delete cascade,
  voter_key  uuid        not null,
  voter_name text        not null check (char_length(voter_name) between 1 and 20),
  place_id   text        not null,
  wants      boolean     not null,
  updated_at timestamptz not null default now(),
  primary key (poll_id, voter_key, place_id)
);

alter table public.poll_votes enable row level security;
-- ルールは作らない(=直接はだれも読み書きできない)。下の2つの関数だけを通す。

-- 投票する: 候補ぜんぶへの答えをまとめて送る。votes は [{"place_id": "...", "wants": true}, ...]
create or replace function public.cast_votes(
  poll_id uuid,
  voter_key uuid,
  voter_name text,
  votes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls%rowtype;
  v jsonb;
begin
  select * into p from public.polls where id = cast_votes.poll_id;
  if not found then
    raise exception 'poll not found';
  end if;
  if p.closed_at is not null or p.closes_at <= now() then
    raise exception 'poll is closed';
  end if;
  if char_length(coalesce(trim(cast_votes.voter_name), '')) not between 1 and 20 then
    raise exception 'invalid name';
  end if;
  for v in select * from jsonb_array_elements(cast_votes.votes) loop
    if not ((v ->> 'place_id') = any (p.place_ids)) then
      raise exception 'not a candidate';
    end if;
    insert into public.poll_votes (poll_id, voter_key, voter_name, place_id, wants, updated_at)
    values (p.id, cast_votes.voter_key, trim(cast_votes.voter_name), v ->> 'place_id',
            (v ->> 'wants')::boolean, now())
    on conflict on constraint poll_votes_pkey do update
      set voter_name = excluded.voter_name, wants = excluded.wants, updated_at = now();
  end loop;
end;
$$;

-- 結果を見る: 投票した人(voter_key)か作った人だけ。終わった投票は誰でも。それ以外には null。
-- {"voters": 3, "places": [{"place_id": "...", "names": ["ゆき", "けん"]}, ...]}
create or replace function public.get_poll_results(poll_id uuid, voter_key uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.polls p where p.id = get_poll_results.poll_id)
      then null
    when not (
      exists (select 1 from public.poll_votes v
              where v.poll_id = get_poll_results.poll_id
                and v.voter_key = get_poll_results.voter_key)
      or exists (select 1 from public.polls p
                 where p.id = get_poll_results.poll_id
                   and (p.owner_id = auth.uid() or p.closed_at is not null or p.closes_at <= now()))
    ) then null
    else jsonb_build_object(
      'has_voted', exists (select 1 from public.poll_votes v
                           where v.poll_id = get_poll_results.poll_id
                             and v.voter_key = get_poll_results.voter_key),
      'voters', (select count(distinct v.voter_key) from public.poll_votes v
                 where v.poll_id = get_poll_results.poll_id),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('place_id', pid, 'names', names))
        from (
          select u.pid,
                 coalesce((select jsonb_agg(v.voter_name order by v.updated_at)
                           from public.poll_votes v
                           where v.poll_id = get_poll_results.poll_id
                             and v.place_id = u.pid and v.wants), '[]'::jsonb) as names
          from public.polls p, unnest(p.place_ids) as u(pid)
          where p.id = get_poll_results.poll_id
        ) t
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.cast_votes(uuid, uuid, text, jsonb) from public;
grant execute on function public.cast_votes(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.get_poll_results(uuid, uuid) from public;
grant execute on function public.get_poll_results(uuid, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────
-- 7. 投票を終えて1軒に決める
--    - 作った人が close_poll() で終える。1位が1軒ならその店に決定(decided_by = 'votes')。
--    - 1位が並んだら tied_place_ids に入れて待つ。作った人が resolve_tie() で
--      'roulette'(並んだ店からランダムに1軒) か 'runoff'(並んだ店だけで新しい投票=決選投票) を選ぶ。
--    - 決選投票(parent_poll_id がある投票)でも並んだら、自動でルーレット。
--    - 3日たって自動で終わった投票は、誰かが開いたときに finalize_if_expired() で決める
--      (作った人がいないので、並んだら自動でルーレット)。
--    - どの店に決まったかはサーバーで1回だけ決めて保存するので、全員に同じ結果が出る。
-- ─────────────────────────────────────────────
alter table public.polls add column if not exists winner_place_id text;
alter table public.polls add column if not exists decided_by text
  check (decided_by in ('votes', 'roulette'));
alter table public.polls add column if not exists tied_place_ids text[];
alter table public.polls add column if not exists parent_poll_id uuid
  references public.polls (id) on delete cascade;
alter table public.polls add column if not exists runoff_poll_id uuid
  references public.polls (id) on delete set null;

-- 返す列が増えたので、前の get_poll はいったん消して作り直す
drop function if exists public.get_poll(uuid);
create function public.get_poll(poll_id uuid)
returns table (
  id uuid,
  title text,
  place_ids text[],
  created_at timestamptz,
  closes_at timestamptz,
  closed_at timestamptz,
  is_open boolean,
  is_owner boolean,
  winner_place_id text,
  decided_by text,
  tied_place_ids text[],
  parent_poll_id uuid,
  runoff_poll_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.place_ids, p.created_at, p.closes_at, p.closed_at,
         (p.closed_at is null and p.closes_at > now()) as is_open,
         (p.owner_id = auth.uid()) as is_owner,
         p.winner_place_id, p.decided_by, p.tied_place_ids, p.parent_poll_id, p.runoff_poll_id
  from public.polls p
  where p.id = poll_id;
$$;

revoke all on function public.get_poll(uuid) from public;
grant execute on function public.get_poll(uuid) to anon, authenticated;

-- 中で使うだけ(外からは呼べない): 票を数えて、1位が1軒なら決定、並んだら tied_place_ids。
-- auto_roulette = true なら、並んだときもその場でルーレットで決める。
create or replace function public.decide_poll(p_id uuid, auto_roulette boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls%rowtype;
  top text[];
begin
  select * into p from public.polls where id = p_id for update;
  if p.winner_place_id is not null or p.tied_place_ids is not null then
    return; -- もう決まっている
  end if;

  with counts as (
    select u.pid, count(v.*) filter (where v.wants) as n
    from unnest(p.place_ids) as u(pid)
    left join public.poll_votes v on v.poll_id = p.id and v.place_id = u.pid
    group by u.pid
  )
  select array_agg(pid) into top from counts where n = (select max(n) from counts);

  if array_length(top, 1) = 1 then
    update public.polls set closed_at = coalesce(closed_at, now()),
      winner_place_id = top[1], decided_by = 'votes' where id = p.id;
  elsif auto_roulette or p.parent_poll_id is not null then
    update public.polls set closed_at = coalesce(closed_at, now()),
      winner_place_id = top[1 + floor(random() * array_length(top, 1))::int],
      decided_by = 'roulette', tied_place_ids = top where id = p.id;
  else
    update public.polls set closed_at = coalesce(closed_at, now()),
      tied_place_ids = top where id = p.id;
  end if;
end;
$$;
revoke all on function public.decide_poll(uuid, boolean) from public, anon, authenticated;

-- 作った人が「投票を終わる」
create or replace function public.close_poll(poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.polls p
                 where p.id = close_poll.poll_id and p.owner_id = auth.uid()) then
    raise exception 'not the owner';
  end if;
  perform public.decide_poll(close_poll.poll_id, false);
end;
$$;
revoke all on function public.close_poll(uuid) from public;
grant execute on function public.close_poll(uuid) to authenticated;

-- 作った人が、並んだときの決め方を選ぶ。'runoff' なら決選投票の新しい投票IDを返す。
create or replace function public.resolve_tie(poll_id uuid, method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls%rowtype;
  new_id uuid;
begin
  select * into p from public.polls where id = resolve_tie.poll_id for update;
  if not found or p.owner_id is distinct from auth.uid() then
    raise exception 'not the owner';
  end if;
  if p.winner_place_id is not null or p.runoff_poll_id is not null or p.tied_place_ids is null then
    raise exception 'nothing to resolve';
  end if;

  if method = 'roulette' then
    update public.polls set
      winner_place_id = p.tied_place_ids[1 + floor(random() * array_length(p.tied_place_ids, 1))::int],
      decided_by = 'roulette'
    where id = p.id;
    return null;
  elsif method = 'runoff' and p.parent_poll_id is null then
    insert into public.polls (owner_id, title, place_ids, parent_poll_id)
    values (p.owner_id, left(p.title || '（決選）', 40), p.tied_place_ids, p.id)
    returning id into new_id;
    update public.polls set runoff_poll_id = new_id where id = p.id;
    return new_id;
  else
    raise exception 'invalid method';
  end if;
end;
$$;
revoke all on function public.resolve_tie(uuid, text) from public;
grant execute on function public.resolve_tie(uuid, text) to authenticated;

-- 3日たって自動で終わった投票を決める(誰が開いても同じ結果。並んだら自動でルーレット)
create or replace function public.finalize_if_expired(poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.polls p
             where p.id = finalize_if_expired.poll_id
               and p.closed_at is null and p.closes_at <= now()) then
    perform public.decide_poll(finalize_if_expired.poll_id, true);
  end if;
end;
$$;
revoke all on function public.finalize_if_expired(uuid) from public;
grant execute on function public.finalize_if_expired(uuid) to anon, authenticated;
