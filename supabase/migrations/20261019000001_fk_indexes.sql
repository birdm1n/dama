-- =============================================================================
-- 0009 · 외래 키 인덱스 (Supabase 성능 점검 결과)
-- auth.users를 가리키는 FK에 인덱스가 없으면 회원 탈퇴(ON DELETE CASCADE / SET NULL) 때
-- 해당 테이블 전체를 훑는다. post_likes·post_reports는 사용자 수에 비례해 커진다.
-- =============================================================================

create index if not exists couple_invites_created_by_idx on public.couple_invites (created_by);
create index if not exists couple_invites_used_by_idx on public.couple_invites (used_by);
create index if not exists couples_created_by_idx on public.couples (created_by);
create index if not exists post_likes_user_idx on public.post_likes (user_id);
create index if not exists post_reports_reporter_idx on public.post_reports (reporter_id, created_at);
