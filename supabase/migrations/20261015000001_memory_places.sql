-- =============================================================================
-- 0005 · 기록의 장소(memory_places)
--
-- 장소는 기록에 속한다(커플 공용 장소 목록이 아님). 그래서 가시성이 기록과 똑같다:
--  * 기록을 볼 수 있으면 그 기록의 장소도 본다(초안이면 작성자만, 공유면 둘 다, 보관 중이면 작성자만).
--  * 장소 추가·수정·삭제는 기록 작성자만, 활성 커플에서만.
-- seq는 기록 안에서의 순서다. 지도에서 장소를 잇는 선은 이 순서(기록 순서)를 따른 것이지
-- 실제 이동 경로가 아니다. 화면에 반드시 그렇게 표시한다.
-- =============================================================================

create table public.memory_places (
  id              uuid primary key default gen_random_uuid(),
  memory_id       uuid not null references public.memories (id) on delete cascade,
  couple_id       uuid not null references public.couples (id) on delete cascade,
  seq             int not null check (seq between 0 and 999),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  address         text check (address is null or char_length(address) <= 200),
  lat             numeric(9, 6) not null check (lat between -90 and 90),
  lng             numeric(9, 6) not null check (lng between -180 and 180),
  location_source text not null check (location_source in ('exif', 'device', 'manual')),
  accuracy_m      numeric(10, 1) check (accuracy_m >= 0),
  created_at      timestamptz not null default now(),
  -- 직접 지정한 위치는 정확도를 알 수 없다
  check (location_source <> 'manual' or accuracy_m is null)
);
comment on column public.memory_places.seq is '기록 안의 순서. 지도 연결선은 이 순서이며 실제 이동 경로가 아니다.';
comment on column public.memory_places.location_source is 'exif: 사진 정보 / device: 기기 현재 위치 / manual: 지도에서 직접 지정';

create index memory_places_memory_idx on public.memory_places (memory_id, seq);
create index memory_places_couple_idx on public.memory_places (couple_id);

-- 기록당 장소 최대 20개
create function private.limit_memory_places()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.memory_places where memory_id = new.memory_id) >= 20 then
    raise exception 'TOO_MANY_PLACES' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger memory_places_limit before insert on public.memory_places
  for each row execute function private.limit_memory_places();

revoke all on public.memory_places from public, anon, authenticated;
grant select, delete on public.memory_places to authenticated;
grant insert (memory_id, couple_id, seq, name, address, lat, lng, location_source, accuracy_m)
  on public.memory_places to authenticated;
grant update (seq, name, address) on public.memory_places to authenticated;

alter table public.memory_places enable row level security;

-- 기록을 볼 수 있으면 장소도 본다. (서브쿼리는 호출자 권한으로 실행되어 memories의 RLS가 그대로 적용된다)
create policy memory_places_select on public.memory_places for select to authenticated
  using (exists (select 1 from public.memories m where m.id = memory_id));

create policy memory_places_insert on public.memory_places for insert to authenticated
  with check (private.is_active_member(couple_id) and private.is_my_memory(memory_id, couple_id));

create policy memory_places_update on public.memory_places for update to authenticated
  using (private.is_active_member(couple_id) and private.is_my_memory(memory_id, couple_id))
  with check (private.is_active_member(couple_id) and private.is_my_memory(memory_id, couple_id));

create policy memory_places_delete on public.memory_places for delete to authenticated
  using (private.is_active_member(couple_id) and private.is_my_memory(memory_id, couple_id));

-- 순서 바꾸기: 이웃한 장소와 seq를 맞바꾼다. SECURITY INVOKER라 RLS가 적용되어 작성자만 바꿀 수 있다.
create function public.move_memory_place(p_place_id uuid, p_direction int)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_me    public.memory_places%rowtype;
  v_other public.memory_places%rowtype;
  v_n     int;
begin
  select * into v_me from public.memory_places where id = p_place_id;
  if not found then return false; end if;

  if p_direction < 0 then
    select * into v_other from public.memory_places
     where memory_id = v_me.memory_id and (seq, id) < (v_me.seq, v_me.id)
     order by seq desc, id desc limit 1;
  else
    select * into v_other from public.memory_places
     where memory_id = v_me.memory_id and (seq, id) > (v_me.seq, v_me.id)
     order by seq, id limit 1;
  end if;
  if not found then return false; end if;

  update public.memory_places
     set seq = case when id = v_me.id then v_other.seq else v_me.seq end
   where id in (v_me.id, v_other.id);
  get diagnostics v_n = row_count;
  return v_n = 2;
end;
$$;
revoke all on function public.move_memory_place(uuid, int) from public, anon;
grant execute on function public.move_memory_place(uuid, int) to authenticated;
