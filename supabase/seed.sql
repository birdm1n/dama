-- =============================================================================
-- 로컬 개발용 샘플 데이터 (supabase start / supabase db reset 때만 적용된다)
-- 모든 샘플은 제목·이름에 [샘플]이 붙어 있어 실제 데이터와 구별된다.
--
--   sample-a@dama.local / sample1234   (샘플 하나)
--   sample-b@dama.local / sample1234   (샘플 두리)
-- =============================================================================

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  c uuid := '00000000-0000-4000-8000-0000000000c1';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('sample1234', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.name),
         now(), now(), '', '', '', ''
  from (values (a, 'sample-a@dama.local', '[샘플] 하나'), (b, 'sample-b@dama.local', '[샘플] 두리')) as u(id, email, name)
  on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u where u.id in (a, b)
  on conflict do nothing;

  insert into public.couples (id, name, anniversary_on, created_by)
  values (c, '[샘플] 우리의 주말', '2025-05-17', a)
  on conflict (id) do nothing;

  insert into public.couple_members (couple_id, user_id)
  values (c, a), (c, b)
  on conflict do nothing;

  if not exists (select 1 from public.memories where couple_id = c) then
    insert into public.memories (couple_id, author_id, title, body, happened_on, tags, share_status) values
      (c, a, '[샘플] 첫 만남, 성수동 카페', '창가 자리에서 두 시간 넘게 이야기했다.' || E'\n' || '라테 아트가 하트였던 게 아직도 웃기다.', '2025-05-17', '{카페,성수}', 'shared'),
      (c, b, '[샘플] 한강 피크닉', '돗자리 펴고 김밥. 해 질 때 바람이 좋았다.', '2025-06-08', '{한강,피크닉}', 'shared'),
      (c, a, '[샘플] 비 오는 날 전시', '우산 하나로 같이 걸었다.', '2025-07-12', '{전시,비}', 'shared'),
      (c, b, '[샘플] 다음 기념일 계획 (두리만 보기)', '깜짝 선물 아이디어 메모. 아직 공유하지 않은 초안이다.', '2025-08-01', '{계획}', 'draft'),
      (c, a, '[샘플] 혼자 적어둔 메모 (하나만 보기)', '공유하지 않은 기록은 상대에게 보이지 않는다.', '2025-08-20', '{}', 'draft');
  end if;
end;
$$;
