-- =============================================================================
-- 0004 · 저장소 파일 정리 작업용 함수
-- 서버 작업(/api/cron/storage-cleanup, service_role 키 사용)이 대기열을 가져가 Storage API로 지운다.
-- service_role만 실행할 수 있다.
-- =============================================================================

alter table private.storage_deletion_queue
  add column attempts int not null default 0,
  add column claimed_at timestamptz;

-- 처리할 항목을 가져간다. 5분 넘게 끝나지 않은 항목은 다시 가져갈 수 있다.
create function public.claim_storage_deletions(p_limit int default 100)
returns table (id bigint, bucket_id text, path text)
language sql security definer set search_path = ''
as $$
  update private.storage_deletion_queue q
     set claimed_at = now(), attempts = q.attempts + 1
   where q.id in (
     select id from private.storage_deletion_queue
      where (claimed_at is null or claimed_at < now() - interval '5 minutes') and attempts < 10
      order by id
      limit least(greatest(coalesce(p_limit, 100), 1), 1000)
      for update skip locked
   )
  returning q.id, q.bucket_id, q.path;
$$;

create function public.complete_storage_deletions(p_ids bigint[])
returns int
language sql security definer set search_path = ''
as $$
  with d as (delete from private.storage_deletion_queue where id = any (p_ids) returning 1)
  select count(*)::int from d;
$$;

revoke all on function public.claim_storage_deletions(int), public.complete_storage_deletions(bigint[])
  from public, anon, authenticated;
grant execute on function public.claim_storage_deletions(int), public.complete_storage_deletions(bigint[])
  to service_role;
