-- =============================================================================
-- 0001 · 프로필 · 커플 · 초대
--
-- 원칙
--  * 커플 데이터 격리는 RLS로 강제한다. 프런트 검증은 보조 수단일 뿐이다.
--  * 상태를 바꾸는 작업(커플 생성, 초대, 수락, 해제)은 SECURITY DEFINER RPC로만 한다.
--    테이블에 대한 INSERT/DELETE 권한은 클라이언트 역할에 주지 않는다.
--  * Supabase는 public 스키마의 새 테이블·함수에 anon/authenticated 권한을 기본으로
--    준다. 그래서 여기서는 먼저 전부 회수(REVOKE)하고 필요한 것만 명시적으로 준다.
--  * 초대 토큰 원문은 저장하지 않고 sha256 해시만 저장한다.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- RLS 헬퍼처럼 API(PostgREST)로 노출할 필요가 없는 함수는 private 스키마에 둔다.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 테이블
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is
  '사용자 공개 프로필. 이메일 등 민감 정보는 두지 않는다(auth.users에만 존재).';

create table public.couples (
  id             uuid primary key default gen_random_uuid(),
  name           text check (name is null or char_length(btrim(name)) between 1 and 40),
  anniversary_on date,
  status         text not null default 'active' check (status in ('active', 'dissolved')),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  dissolved_at   timestamptz,
  -- 해제 후 이 시각이 지나면 커플과 하위 데이터 전체를 영구 삭제한다.
  purge_after    timestamptz,
  constraint couples_dissolved_consistency check (
    (status = 'active'    and dissolved_at is null     and purge_after is null) or
    (status = 'dissolved' and dissolved_at is not null and purge_after is not null)
  )
);
comment on column public.couples.purge_after is
  '연결 해제 후 영구 삭제 예정 시각(해제 + 30일). 그 전까지 각자 자기가 쓴 기록만 읽기 전용으로 접근.';

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (couple_id, user_id)
);
-- 한 사람은 동시에 하나의 활성 커플에만 속한다.
create unique index couple_members_one_active_couple_per_user
  on public.couple_members (user_id) where left_at is null;
create index couple_members_user_idx on public.couple_members (user_id);

create table public.couple_invites (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  token_hash  bytea not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  revoked_at  timestamptz,
  check (expires_at > created_at)
);
create index couple_invites_couple_idx on public.couple_invites (couple_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 헬퍼 (SECURITY DEFINER: RLS 정책 안에서 couple_members를 다시 조회할 때
-- 정책이 자기 자신을 재귀 호출하지 않도록 한다)
-- -----------------------------------------------------------------------------

create function private.is_active_member(p_couple_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members m
    join public.couples c on c.id = m.couple_id
    where m.couple_id = p_couple_id
      and m.user_id = auth.uid()
      and m.left_at is null
      and c.status = 'active'
  );
$$;

create function private.was_member(p_couple_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple_id and m.user_id = auth.uid()
  );
$$;

create function private.shares_active_couple_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members me
    join public.couple_members other on other.couple_id = me.couple_id
    join public.couples c on c.id = me.couple_id
    where me.user_id = auth.uid() and me.left_at is null
      and other.user_id = p_user_id and other.left_at is null
      and c.status = 'active'
  );
$$;

create function private.my_active_couple_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.couple_id
  from public.couple_members m
  join public.couples c on c.id = m.couple_id
  where m.user_id = auth.uid() and m.left_at is null and c.status = 'active'
  limit 1;
$$;

create function private.hash_invite_token(p_token text)
returns bytea
language sql immutable set search_path = ''
as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.is_active_member(uuid),
  private.was_member(uuid),
  private.shares_active_couple_with(uuid),
  private.my_active_couple_id()
to authenticated;

-- -----------------------------------------------------------------------------
-- 트리거
-- -----------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger couples_touch before update on public.couples
  for each row execute function private.touch_updated_at();

-- 가입 시 프로필 자동 생성. 표시 이름은 가입 폼에서 받은 값, 없으면 이메일 앞부분.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  )), 30);
  if v_name = '' then
    v_name := '이름 없음';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- 활성 멤버는 커플당 최대 2명. 커플 행을 잠가 동시 수락 경쟁을 막는다.
create function private.enforce_couple_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_count  int;
begin
  if new.left_at is not null then
    return new;
  end if;
  select status into v_status from public.couples where id = new.couple_id for update;
  if v_status is distinct from 'active' then
    raise exception 'COUPLE_INACTIVE' using errcode = 'P0001';
  end if;
  select count(*) into v_count
  from public.couple_members
  where couple_id = new.couple_id and left_at is null
    and user_id <> new.user_id;
  if v_count >= 2 then
    raise exception 'COUPLE_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger couple_members_capacity before insert or update on public.couple_members
  for each row execute function private.enforce_couple_capacity();

-- -----------------------------------------------------------------------------
-- 권한 (기본 권한을 모두 회수하고 필요한 것만 준다)
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.couples, public.couple_members, public.couple_invites
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

grant select on public.couples to authenticated;
grant update (name, anniversary_on) on public.couples to authenticated;

grant select on public.couple_members to authenticated;

-- token_hash 컬럼은 클라이언트에 절대 노출하지 않는다.
grant select (id, couple_id, created_by, created_at, expires_at, used_at, used_by, revoked_at)
  on public.couple_invites to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;

-- profiles: 나 자신과, 현재 활성 커플의 상대만 볼 수 있다.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_active_couple_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- couples: 활성 멤버는 활성 커플을, 이전 멤버는 해제된(보관 중) 커플을 읽을 수 있다.
create policy couples_select on public.couples for select to authenticated
  using (
    private.is_active_member(id)
    or (status = 'dissolved' and purge_after > now() and private.was_member(id))
  );
create policy couples_update_members on public.couples for update to authenticated
  using (private.is_active_member(id)) with check (private.is_active_member(id));

-- couple_members: 활성 커플의 멤버 목록, 그리고 내 자신의 과거 멤버십 행.
create policy couple_members_select on public.couple_members for select to authenticated
  using (private.is_active_member(couple_id) or user_id = (select auth.uid()));

-- couple_invites: 활성 커플 멤버만 자기 커플의 초대 이력을 본다(해시는 컬럼 권한으로 차단).
create policy couple_invites_select on public.couple_invites for select to authenticated
  using (private.is_active_member(couple_id));

-- -----------------------------------------------------------------------------
-- RPC
-- 오류는 클라이언트가 분기할 수 있도록 메시지를 대문자 코드로 통일한다.
-- -----------------------------------------------------------------------------

create function public.create_couple(p_name text default null, p_anniversary_on date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid and left_at is null) then
    raise exception 'ALREADY_IN_COUPLE' using errcode = 'P0001';
  end if;

  insert into public.couples (name, anniversary_on, created_by)
  values (nullif(btrim(p_name), ''), p_anniversary_on, v_uid)
  returning id into v_id;

  insert into public.couple_members (couple_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;

-- 초대 링크 발급: 24시간·1회용. 새로 발급하면 이전 미사용 초대는 자동 취소된다.
create function public.create_invite()
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
  v_token     text;
  v_expires   timestamptz := now() + interval '24 hours';
  v_recent    int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_couple_id := private.my_active_couple_id();
  if v_couple_id is null then
    raise exception 'NOT_IN_COUPLE' using errcode = 'P0001';
  end if;

  perform 1 from public.couples where id = v_couple_id for update;

  if (select count(*) from public.couple_members
      where couple_id = v_couple_id and left_at is null) >= 2 then
    raise exception 'COUPLE_FULL' using errcode = 'P0001';
  end if;

  select count(*) into v_recent from public.couple_invites
  where couple_id = v_couple_id and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  update public.couple_invites
     set revoked_at = now()
   where couple_id = v_couple_id
     and used_at is null and revoked_at is null;

  -- 32바이트 난수 → base64url (패딩 없음)
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.couple_invites (couple_id, token_hash, created_by, expires_at)
  values (v_couple_id, private.hash_invite_token(v_token), v_uid, v_expires);

  return query select v_token, v_expires;
end;
$$;

-- 초대 링크를 연 사람에게 "누가 초대했는지"만 보여준다. 토큰을 가진 로그인 사용자만 호출 가능.
create function public.get_invite_preview(p_token text)
returns table (inviter_name text, couple_name text, expires_at timestamptz, status text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv  public.couple_invites%rowtype;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_inv from public.couple_invites
  where token_hash = private.hash_invite_token(coalesce(p_token, ''));
  if not found then
    return query select null::text, null::text, null::timestamptz, 'invalid'::text;
    return;
  end if;

  v_status := case
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.used_at is not null then 'used'
    when v_inv.expires_at <= now() then 'expired'
    when v_inv.created_by = auth.uid() then 'own'
    else 'valid'
  end;

  if v_status <> 'valid' and v_status <> 'own' then
    -- 무효한 초대에 대해서는 초대한 사람 정보를 노출하지 않는다.
    return query select null::text, null::text, v_inv.expires_at, v_status;
    return;
  end if;

  return query
  select p.display_name, c.name, v_inv.expires_at, v_status
  from public.couples c
  left join public.profiles p on p.id = v_inv.created_by
  where c.id = v_inv.couple_id;
end;
$$;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.couple_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_inv from public.couple_invites
  where token_hash = private.hash_invite_token(coalesce(p_token, ''))
  for update;

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'INVITE_REVOKED' using errcode = 'P0001';
  end if;
  if v_inv.used_at is not null then
    raise exception 'INVITE_USED' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_members
             where couple_id = v_inv.couple_id and user_id = v_uid) then
    raise exception 'INVITE_OWN' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid and left_at is null) then
    raise exception 'ALREADY_IN_COUPLE' using errcode = 'P0001';
  end if;

  -- 정원·활성 여부는 트리거(enforce_couple_capacity)가 커플 행을 잠근 상태로 검증한다.
  insert into public.couple_members (couple_id, user_id) values (v_inv.couple_id, v_uid);

  update public.couple_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  update public.couple_invites set revoked_at = now()
   where couple_id = v_inv.couple_id and id <> v_inv.id
     and used_at is null and revoked_at is null;

  return v_inv.couple_id;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  update public.couple_invites i
     set revoked_at = now()
   where i.id = p_invite_id
     and i.used_at is null and i.revoked_at is null
     and private.is_active_member(i.couple_id);
  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- 연결 해제: 어느 한쪽이 해제하면 커플이 끝난다.
--  * 두 멤버 모두 활성 멤버십이 종료되고, 커플은 dissolved 상태가 된다.
--  * 30일 동안 각자 "자기가 쓴" 기록만 읽기 전용으로 볼 수 있다(상대 기록은 즉시 차단).
--  * purge_after가 지나면 private.purge_dissolved_couples()가 영구 삭제한다.
create function public.leave_couple()
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_couple_id uuid;
  v_purge     timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  v_couple_id := private.my_active_couple_id();
  if v_couple_id is null then
    raise exception 'NOT_IN_COUPLE' using errcode = 'P0001';
  end if;

  perform 1 from public.couples where id = v_couple_id for update;

  update public.couple_members set left_at = now()
   where couple_id = v_couple_id and left_at is null;
  update public.couple_invites set revoked_at = now()
   where couple_id = v_couple_id and used_at is null and revoked_at is null;
  update public.couples
     set status = 'dissolved', dissolved_at = now(), purge_after = v_purge
   where id = v_couple_id;

  return v_purge;
end;
$$;

-- 보관 기간이 지난 해제 커플 영구 삭제. pg_cron(가능한 환경)에서 매일 호출한다.
create function private.purge_dissolved_couples()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.couples where status = 'dissolved' and purge_after <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.purge_dissolved_couples() from public, anon, authenticated;

revoke all on function
  public.create_couple(text, date),
  public.create_invite(),
  public.get_invite_preview(text),
  public.accept_invite(text),
  public.revoke_invite(uuid),
  public.leave_couple()
from public, anon;
grant execute on function
  public.create_couple(text, date),
  public.create_invite(),
  public.get_invite_preview(text),
  public.accept_invite(text),
  public.revoke_invite(uuid),
  public.leave_couple()
to authenticated;

-- 매일 03:17(UTC)에 보관 기간이 지난 커플 삭제. pg_cron이 없는 환경에서는 건너뛴다.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('purge-dissolved-couples', '17 3 * * *',
                            'select private.purge_dissolved_couples()');
    exception when others then
      raise notice 'pg_cron 스케줄 등록 실패: % (수동으로 private.purge_dissolved_couples() 를 호출하세요)', sqlerrm;
    end;
  end if;
end;
$$;
