-- =============================================================================
-- 0006 · 발견(Date Discovery): 공개 게시물 · 좋아요 · 북마크 · 신고 · 차단
--
-- 원칙
--  * 공개 게시물은 개인 기록의 "사본"이다. 사용자가 확인 화면에서 직접 고른 글·사진·장소만 복사된다.
--    개인 기록을 고치거나 지워도 공개본은 바뀌지 않고, 공개본에는 couple_id가 없다.
--  * 작성자 이름·프로필은 노출하지 않는다(화면에는 "익명의 커플"). author_id(무작위 UUID)는 차단에 쓴다.
--  * 이미지는 비공개 버킷(post-images)에 두고, 게시물을 볼 수 있는 사람에게만 서명 URL로 준다.
--    숨김·삭제·차단된 게시물의 이미지는 바로 접근할 수 없게 된다.
--  * 서로 다른 사용자 사이의 일(신고 집계, 카운트)은 SECURITY DEFINER 트리거로만 처리한다.
--  * 발견은 로그인한 사용자만 볼 수 있다(익명 크롤링·대량 수집 방지).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 테이블
-- -----------------------------------------------------------------------------

create table public.public_posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('place', 'course')),
  title          text not null check (char_length(btrim(title)) between 1 and 80),
  body           text not null default '' check (char_length(body) <= 3000),
  area           text check (area is null or char_length(btrim(area)) between 1 and 40),
  tags           text[] not null default '{}' check (private.valid_tags(tags)),
  -- published: 공개 / hidden: 작성자가 숨김 / under_review: 신고 누적으로 자동 숨김(운영 검토 대기)
  status         text not null default 'published' check (status in ('published', 'hidden', 'under_review')),
  like_count     int not null default 0,
  bookmark_count int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index public_posts_feed_idx on public.public_posts (status, created_at desc);
create index public_posts_author_idx on public.public_posts (author_id, created_at desc);
create index public_posts_tags_idx on public.public_posts using gin (tags);

create trigger public_posts_touch before update on public.public_posts
  for each row execute function private.touch_updated_at();

create table public.public_post_places (
  id      uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.public_posts (id) on delete cascade,
  seq     int not null check (seq between 0 and 99),
  name    text not null check (char_length(btrim(name)) between 1 and 60),
  lat     numeric(9, 6) not null check (lat between -90 and 90),
  lng     numeric(9, 6) not null check (lng between -180 and 180)
);
create index public_post_places_post_idx on public.public_post_places (post_id, seq);

create table public.public_post_images (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.public_posts (id) on delete cascade,
  seq          int not null check (seq between 0 and 99),
  storage_path text not null unique,  -- {post_id}/{uuid}.webp (post-images 버킷)
  width        int not null check (width between 1 and 10000),
  height       int not null check (height between 1 and 10000)
);
create index public_post_images_post_idx on public.public_post_images (post_id, seq);

create table public.post_likes (
  post_id    uuid not null references public.public_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_bookmarks (
  post_id    uuid not null references public.public_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_bookmarks_user_idx on public.post_bookmarks (user_id, created_at desc);

create table public.post_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.public_posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'inappropriate', 'privacy', 'other')),
  detail      text check (detail is null or char_length(detail) <= 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- 헬퍼
-- -----------------------------------------------------------------------------

-- 나와 상대 사이에 어느 쪽으로든 차단이 있는가 (차단은 양방향으로 서로 안 보이게 한다)
create function private.blocked_between(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  );
$$;

-- 이 게시물이 내 것인가
create function private.is_my_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.public_posts p where p.id = p_post_id and p.author_id = auth.uid());
$$;

-- 저장소 경로의 첫 폴더가 내 게시물 id인가. 형식부터 검사해 다른 버킷 경로에서 uuid 변환 오류가 나지 않게 한다.
create function private.is_my_post_path(p_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.is_my_post(v_folder::uuid);
end;
$$;

revoke all on function private.blocked_between(uuid), private.is_my_post(uuid), private.is_my_post_path(text) from public, anon;
grant execute on function private.blocked_between(uuid), private.is_my_post(uuid), private.is_my_post_path(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 트리거: 개수 제한 · 카운트 · 신고 누적 자동 숨김 · 이미지 파일 정리
-- -----------------------------------------------------------------------------

create function private.limit_public_posts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.public_posts
      where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'POST_RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger public_posts_limit before insert on public.public_posts
  for each row execute function private.limit_public_posts();

create function private.sync_post_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
  v_delta int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'post_likes' then
    update public.public_posts set like_count = greatest(like_count + v_delta, 0) where id = v_post;
  else
    update public.public_posts set bookmark_count = greatest(bookmark_count + v_delta, 0) where id = v_post;
  end if;
  return null;
end;
$$;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function private.sync_post_counts();
create trigger post_bookmarks_count after insert or delete on public.post_bookmarks
  for each row execute function private.sync_post_counts();

-- 서로 다른 3명 이상이 신고하면 자동으로 숨기고 운영 검토 대기로 둔다
create function private.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.post_reports where post_id = new.post_id and status = 'open') >= 3 then
    update public.public_posts set status = 'under_review' where id = new.post_id and status = 'published';
  end if;
  return null;
end;
$$;
create trigger post_reports_auto_hide after insert on public.post_reports
  for each row execute function private.auto_hide_reported();

create function private.limit_reports()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.post_reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'REPORT_RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger post_reports_limit before insert on public.post_reports
  for each row execute function private.limit_reports();

create function private.queue_post_image_files()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.storage_deletion_queue (bucket_id, path) values ('post-images', old.storage_path);
  return old;
end;
$$;
create trigger public_post_images_queue after delete on public.public_post_images
  for each row execute function private.queue_post_image_files();

-- -----------------------------------------------------------------------------
-- 권한
-- -----------------------------------------------------------------------------

revoke all on public.public_posts, public.public_post_places, public.public_post_images,
  public.post_likes, public.post_bookmarks, public.post_reports, public.user_blocks
  from public, anon, authenticated;

grant select, delete on public.public_posts to authenticated;
grant insert (author_id, kind, title, body, area, tags) on public.public_posts to authenticated;
grant update (title, body, area, tags, status) on public.public_posts to authenticated;

grant select, delete on public.public_post_places to authenticated;
grant insert (post_id, seq, name, lat, lng) on public.public_post_places to authenticated;

grant select, delete on public.public_post_images to authenticated;
grant insert (post_id, seq, storage_path, width, height) on public.public_post_images to authenticated;

grant select, delete on public.post_likes, public.post_bookmarks, public.user_blocks to authenticated;
grant insert (post_id, user_id) on public.post_likes, public.post_bookmarks to authenticated;
grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;

grant select on public.post_reports to authenticated;
grant insert (post_id, reporter_id, reason, detail) on public.post_reports to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.public_posts       enable row level security;
alter table public.public_post_places enable row level security;
alter table public.public_post_images enable row level security;
alter table public.post_likes         enable row level security;
alter table public.post_bookmarks     enable row level security;
alter table public.post_reports       enable row level security;
alter table public.user_blocks        enable row level security;

-- 게시물: 공개 상태이고 차단 관계가 없으면 누구나(로그인 사용자), 내 글은 상태와 관계없이
create policy public_posts_select on public.public_posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'published' and not private.blocked_between(author_id))
  );
create policy public_posts_insert on public.public_posts for insert to authenticated
  with check (author_id = (select auth.uid()));
-- 작성자는 공개/숨김만 오갈 수 있다. 신고 검토 중인 글은 작성자가 다시 공개할 수 없다.
create policy public_posts_update on public.public_posts for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'under_review')
  with check (author_id = (select auth.uid()) and status in ('published', 'hidden'));
create policy public_posts_delete on public.public_posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- 장소·이미지: 게시물을 볼 수 있으면 본다(서브쿼리에 public_posts의 RLS가 적용된다). 쓰기는 작성자만.
create policy public_post_places_select on public.public_post_places for select to authenticated
  using (exists (select 1 from public.public_posts p where p.id = post_id));
create policy public_post_places_insert on public.public_post_places for insert to authenticated
  with check (private.is_my_post(post_id));
create policy public_post_places_delete on public.public_post_places for delete to authenticated
  using (private.is_my_post(post_id));

create policy public_post_images_select on public.public_post_images for select to authenticated
  using (exists (select 1 from public.public_posts p where p.id = post_id));
create policy public_post_images_insert on public.public_post_images for insert to authenticated
  with check (
    private.is_my_post(post_id)
    and storage_path ~ ('^' || post_id::text || '/[0-9a-f-]{36}\.webp$')
  );
create policy public_post_images_delete on public.public_post_images for delete to authenticated
  using (private.is_my_post(post_id));

-- 좋아요·북마크: 내 행만 보고, 볼 수 있는 남의 게시물에만 단다
create policy post_likes_select on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.public_posts p where p.id = post_id and p.status = 'published')
  );
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy post_bookmarks_select on public.post_bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy post_bookmarks_insert on public.post_bookmarks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.public_posts p where p.id = post_id and p.status = 'published')
  );
create policy post_bookmarks_delete on public.post_bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

-- 신고: 내 신고만 본다. 볼 수 있는 남의 게시물만 신고할 수 있다. 수정·삭제는 운영(service_role)만.
create policy post_reports_select on public.post_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy post_reports_insert on public.post_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.public_posts p where p.id = post_id and p.status = 'published')
    and not private.is_my_post(post_id)
  );

-- 차단: 내 차단 목록만
create policy user_blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 피드 검색 (SECURITY INVOKER: 호출자 RLS 적용 → 숨김·차단 자동 제외)
-- -----------------------------------------------------------------------------

create function public.search_public_posts(
  p_query  text default null,
  p_kind   text default null,
  p_tag    text default null,
  p_limit  int  default 24,
  p_offset int  default 0
)
returns setof public.public_posts
language sql stable security invoker set search_path = ''
as $$
  with pat as (
    select '%' || replace(replace(replace(nullif(btrim(p_query), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as like_pattern,
           nullif(btrim(p_tag), '') as tag
  )
  select p.*
  from public.public_posts p, pat
  where p.status = 'published'
    and (pat.like_pattern is null
         or p.title ilike pat.like_pattern
         or p.body ilike pat.like_pattern
         or p.area ilike pat.like_pattern
         or exists (select 1 from unnest(p.tags) t where t ilike pat.like_pattern))
    and (pat.tag is null or exists (select 1 from unnest(p.tags) t where lower(t) = lower(pat.tag)))
    and (p_kind is null or p.kind = p_kind)
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.search_public_posts(text, text, text, int, int) from public, anon;
grant execute on function public.search_public_posts(text, text, text, int, int) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: 게시물 이미지(비공개 버킷, 서명 URL)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 10 * 1024 * 1024, array['image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 업로드: 내 게시물 폴더에만
create policy post_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and private.is_my_post_path(name)
  );

-- 읽기: 볼 수 있는 public_post_images 행이 가리키는 파일만. 업로드 직후 행을 만들기 전 15분은 작성자만.
create policy post_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images'
    and (
      exists (select 1 from public.public_post_images i where i.storage_path = name)
      or (private.is_my_post_path(name) and created_at > now() - interval '15 minutes')
    )
  );

create policy post_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and private.is_my_post_path(name));
