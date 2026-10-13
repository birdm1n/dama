-- =============================================================================
-- 0008 · 배포 전 보안 점검 후속
--  * profiles.avatar_path: 아바타 기능이 없는데 사용자가 임의 경로를 쓸 수 있었다 → 쓰기 권한 회수
--    (기능을 만들 때 경로 검증 정책과 함께 다시 연다)
--  * 남용 방지: 사용자별 하루 생성 개수 제한 (저장소·DB를 한 계정이 채우지 못하게)
-- =============================================================================

revoke update (avatar_path) on public.profiles from authenticated;

create function private.limit_daily_inserts()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if tg_table_name = 'photos' then
    select count(*) into v_count from public.photos
     where uploader_id = new.uploader_id and created_at > now() - interval '1 day';
    if v_count >= 300 then
      raise exception 'DAILY_LIMIT' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'memories' then
    select count(*) into v_count from public.memories
     where author_id = new.author_id and created_at > now() - interval '1 day';
    if v_count >= 200 then
      raise exception 'DAILY_LIMIT' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger photos_daily_limit before insert on public.photos
  for each row execute function private.limit_daily_inserts();
create trigger memories_daily_limit before insert on public.memories
  for each row execute function private.limit_daily_inserts();
