-- =============================================================================
-- 0007 · 신고 검토(운영)
--
-- 운영자 지정: auth.users.raw_app_meta_data 의 role = 'admin'.
--   app_metadata는 사용자가 스스로 바꿀 수 없고 service_role(Auth Admin API)로만 바꿀 수 있다.
--   예) supabase.auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })
--   바꾼 뒤 그 사용자가 다시 로그인해야 JWT에 반영된다.
--
-- 운영자는
--  * 신고가 걸린 글(검토 대기·내려진 글 포함)과 신고 내용을 볼 수 있다.
--  * 글을 복구(다시 공개, 신고 기각)하거나 내릴(removed, 신고 처리 완료) 수 있다.
--  * 작성자가 직접 숨긴 글은 볼 수 없다(신고 대상이 아니므로).
--  * 모든 결정은 moderation_log에 남는다.
-- =============================================================================

alter table public.public_posts drop constraint public_posts_status_check;
alter table public.public_posts add constraint public_posts_status_check
  check (status in ('published', 'hidden', 'under_review', 'removed'));

create function private.is_admin()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
-- 신고가 걸린 글인가. SECURITY DEFINER로 RLS를 거치지 않는다
-- (post_reports 정책 ↔ public_posts 정책이 서로를 참조하는 순환을 막기 위해)
create function private.has_reports(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.post_reports r where r.post_id = p_post_id);
$$;

revoke all on function private.is_admin(), private.has_reports(uuid) from public, anon;
grant execute on function private.is_admin(), private.has_reports(uuid) to authenticated;

create table private.moderation_log (
  id         bigint generated always as identity primary key,
  post_id    uuid not null,
  admin_id   uuid not null,
  decision   text not null check (decision in ('restore', 'remove')),
  note       text check (note is null or char_length(note) <= 500),
  decided_at timestamptz not null default now()
);
revoke all on private.moderation_log from public, anon, authenticated;

-- 작성자: 검토 대기·내려진 글은 다시 공개할 수 없다(삭제는 가능)
drop policy public_posts_update on public.public_posts;
create policy public_posts_update on public.public_posts for update to authenticated
  using (author_id = (select auth.uid()) and status not in ('under_review', 'removed'))
  with check (author_id = (select auth.uid()) and status in ('published', 'hidden'));

-- 운영자: 신고 검토 대상 글과 신고 내용 열람 (정책은 OR로 합쳐진다)
create policy public_posts_admin_select on public.public_posts for select to authenticated
  using (private.is_admin() and (status in ('under_review', 'removed')
         or private.has_reports(id)));
create policy post_reports_admin_select on public.post_reports for select to authenticated
  using (private.is_admin());

-- 검토 대기열: 미처리 신고가 있거나 검토 대기 중인 글
create function public.admin_report_queue()
returns table (
  post_id uuid, title text, body text, area text, kind text, status text, created_at timestamptz,
  open_reports bigint, reasons text[], details text[], last_reported_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;
  return query
  select p.id, p.title, p.body, p.area, p.kind, p.status, p.created_at,
         count(r.id) filter (where r.status = 'open'),
         array_agg(distinct r.reason) filter (where r.status = 'open'),
         array_remove(array_agg(r.detail order by r.created_at desc) filter (where r.status = 'open'), null),
         max(r.created_at)
  from public.public_posts p
  join public.post_reports r on r.post_id = p.id
  group by p.id
  having count(r.id) filter (where r.status = 'open') > 0 or p.status = 'under_review'
  order by (p.status = 'under_review') desc, max(r.created_at) desc
  limit 200;
end;
$$;

create function public.moderate_post(p_post_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;
  if p_decision not in ('restore', 'remove') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;

  update public.public_posts
     set status = case when p_decision = 'restore' then 'published' else 'removed' end
   where id = p_post_id and status <> 'hidden';
  if not found then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.post_reports
     set status = case when p_decision = 'restore' then 'dismissed' else 'resolved' end
   where post_id = p_post_id and status = 'open';

  insert into private.moderation_log (post_id, admin_id, decision, note)
  values (p_post_id, auth.uid(), p_decision, nullif(btrim(p_note), ''));
end;
$$;

revoke all on function public.admin_report_queue(), public.moderate_post(uuid, text, text) from public, anon;
grant execute on function public.admin_report_queue(), public.moderate_post(uuid, text, text) to authenticated;
