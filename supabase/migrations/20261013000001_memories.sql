-- =============================================================================
-- 0002 · 기록(memories)
--
-- 공유 규칙 ("한 사람의 기록을 상대에게 자동 공유하지 않는다")
--  * share_status = 'draft'  → 작성자만 볼 수 있다.
--  * share_status = 'shared' → 같은 활성 커플의 두 사람이 볼 수 있다.
--  * draft → shared 전환은 작성자만 할 수 있다(= 작성자의 명시적 승인).
--  * 수정·삭제도 작성자만. 상대의 공유 기록은 읽기만 가능.
--
-- 연결 해제 후 보관 기간(purge_after 이전):
--  * 각자 "자기가 쓴" 기록만 읽기 전용으로 볼 수 있다. 상대 기록은 공유됐던 것도 차단.
--
-- 태그는 별도 테이블 대신 text[] 로 둔다. 태그 이름도 기록과 같은 가시성을 갖게 되어
-- 상대가 볼 수 없는 초안의 태그 이름이 새지 않는다.
-- =============================================================================

create function private.valid_tags(p_tags text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(cardinality(p_tags), 0) <= 10
     and coalesce((select bool_and(
            t is not null
            and t = btrim(t)
            and char_length(t) between 1 and 20
            and t !~ '[,#[:cntrl:]]'
          ) from unnest(p_tags) as t), true)
     and coalesce(cardinality(p_tags), 0) = (select count(distinct lower(t)) from unnest(p_tags) as t);
$$;

create table public.memories (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples (id) on delete cascade,
  author_id    uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  body         text not null default '' check (char_length(body) <= 5000),
  happened_on  date not null,
  tags         text[] not null default '{}' check (private.valid_tags(tags)),
  share_status text not null default 'draft' check (share_status in ('draft', 'shared')),
  shared_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((share_status = 'shared') = (shared_at is not null))
);
comment on column public.memories.share_status is
  'draft: 작성자만 / shared: 커플 둘 다. 공유 전환은 작성자만 가능.';

create index memories_couple_timeline_idx on public.memories (couple_id, happened_on desc, created_at desc);
create index memories_author_idx on public.memories (author_id);
create index memories_tags_idx on public.memories using gin (tags);

create trigger memories_touch before update on public.memories
  for each row execute function private.touch_updated_at();

-- 공유 상태가 바뀌면 shared_at을 서버 시각으로 맞춘다(클라이언트 값은 무시).
create function private.memories_sync_shared_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.share_status = 'shared' then
    if tg_op = 'INSERT' or old.share_status is distinct from 'shared' then
      new.shared_at := now();
    else
      new.shared_at := old.shared_at;
    end if;
  else
    new.shared_at := null;
  end if;
  return new;
end;
$$;

create trigger memories_shared_at before insert or update on public.memories
  for each row execute function private.memories_sync_shared_at();

-- 보관 중(해제됐지만 아직 삭제 전)인 이전 커플인가
create function private.in_archive(p_couple_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.couples c
    join public.couple_members m on m.couple_id = c.id
    where c.id = p_couple_id
      and c.status = 'dissolved'
      and c.purge_after > now()
      and m.user_id = auth.uid()
  );
$$;
revoke all on function private.in_archive(uuid), private.valid_tags(text[]) from public, anon;
grant execute on function private.in_archive(uuid), private.valid_tags(text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 권한 · RLS
-- -----------------------------------------------------------------------------

revoke all on public.memories from public, anon, authenticated;
grant select, delete on public.memories to authenticated;
-- couple_id, author_id, shared_at, 타임스탬프는 클라이언트가 정할 수 없다.
grant insert (couple_id, author_id, title, body, happened_on, tags, share_status) on public.memories to authenticated;
grant update (title, body, happened_on, tags, share_status) on public.memories to authenticated;

alter table public.memories enable row level security;

create policy memories_select on public.memories for select to authenticated
  using (
    (private.is_active_member(couple_id)
      and (share_status = 'shared' or author_id = (select auth.uid())))
    or (author_id = (select auth.uid()) and private.in_archive(couple_id))
  );

create policy memories_insert on public.memories for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_active_member(couple_id));

create policy memories_update on public.memories for update to authenticated
  using (author_id = (select auth.uid()) and private.is_active_member(couple_id))
  with check (author_id = (select auth.uid()) and private.is_active_member(couple_id));

create policy memories_delete on public.memories for delete to authenticated
  using (author_id = (select auth.uid()) and private.is_active_member(couple_id));

-- -----------------------------------------------------------------------------
-- 검색 (SECURITY INVOKER: 호출자의 RLS가 그대로 적용된다)
-- 한국어 형태소 사전이 없으므로 부분 일치(ILIKE). 커플당 데이터량에서는 couple_id 인덱스로 충분하다.
-- -----------------------------------------------------------------------------

create function public.search_memories(
  p_query  text default null,
  p_tag    text default null,
  p_from   date default null,
  p_to     date default null,
  p_scope  text default 'all',     -- 'all' | 'shared' | 'draft'
  p_limit  int  default 50,
  p_offset int  default 0
)
returns setof public.memories
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select nullif(btrim(p_query), '') as text,
           nullif(btrim(p_tag), '')   as tag
  ), pat as (
    select '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%' as like_pattern,
           q.tag
    from q
  )
  select m.*
  from public.memories m, pat
  where m.couple_id = private.my_active_couple_id()
    and (pat.like_pattern is null
         or m.title ilike pat.like_pattern
         or m.body ilike pat.like_pattern
         or exists (select 1 from unnest(m.tags) t where t ilike pat.like_pattern))
    and (pat.tag is null or exists (select 1 from unnest(m.tags) t where lower(t) = lower(pat.tag)))
    and (p_from is null or m.happened_on >= p_from)
    and (p_to   is null or m.happened_on <= p_to)
    and (coalesce(p_scope, 'all') = 'all' or m.share_status = p_scope)
  order by m.happened_on desc, m.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 현재 커플에서 내가 볼 수 있는 기록들의 태그 목록(필터 칩용)
create function public.my_memory_tags()
returns table (tag text, uses bigint)
language sql stable security invoker set search_path = ''
as $$
  select min(t) as tag, count(*) as uses
  from public.memories m, unnest(m.tags) t
  where m.couple_id = private.my_active_couple_id()
  group by lower(t)
  order by count(*) desc, min(t)
  limit 100;
$$;

revoke all on function public.search_memories(text, text, date, date, text, int, int), public.my_memory_tags()
  from public, anon;
grant execute on function public.search_memories(text, text, date, date, text, int, int), public.my_memory_tags()
  to authenticated;
grant execute on function private.my_active_couple_id() to authenticated;
