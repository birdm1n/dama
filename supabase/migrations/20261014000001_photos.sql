-- =============================================================================
-- 0003 · 사진(photos) + 비공개 저장소(couple-photos)
--
-- 가시성 ("한 사람의 사진/위치를 상대에게 자동 공유하지 않는다")
--  * 사진은 기본적으로 올린 사람만 본다.
--  * 올린 사람이 자기 기록에 붙이고, 그 기록이 shared 일 때만 상대도 본다.
--    기록을 다시 '나만 보기'로 바꾸면 사진도 즉시 상대에게서 사라진다.
--  * 사진 파일 접근(storage.objects)도 같은 규칙: 볼 수 있는 photos 행이 있어야 읽힌다.
--
-- 위치·시각
--  * EXIF 값은 브라우저에서 추출해 사용자가 확인·수정한 뒤에만 저장한다.
--  * 위치는 출처(location_source)와 정확도(accuracy_m)를 함께 저장한다.
--  * 저장되는 이미지 파일은 브라우저에서 다시 인코딩되어 EXIF(위치 포함)가 제거된 상태다.
-- =============================================================================

create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples (id) on delete cascade,
  uploader_id     uuid not null references auth.users (id) on delete cascade,
  memory_id       uuid references public.memories (id) on delete set null,
  storage_path    text not null unique,
  thumb_path      text not null unique,
  width           int not null check (width between 1 and 10000),
  height          int not null check (height between 1 and 10000),
  bytes           int not null check (bytes between 1 and 20000000),
  taken_at        timestamptz,
  taken_at_source text check (taken_at_source in ('exif', 'manual')),
  lat             numeric(9, 6) check (lat between -90 and 90),
  lng             numeric(9, 6) check (lng between -180 and 180),
  location_source text check (location_source in ('exif', 'device', 'manual')),
  accuracy_m      numeric(10, 1) check (accuracy_m >= 0),
  created_at      timestamptz not null default now(),
  check ((taken_at is null) = (taken_at_source is null)),
  check ((lat is null) = (lng is null)),
  check ((lat is null) = (location_source is null)),
  check (lat is not null or accuracy_m is null)
);
comment on column public.photos.location_source is 'exif: 사진 메타데이터 / device: 기기 위치 / manual: 사용자가 지정';
comment on column public.photos.accuracy_m is '위치 정확도(m). EXIF에 정보가 없으면 null(=알 수 없음).';

create index photos_couple_idx on public.photos (couple_id, taken_at desc nulls last);
create index photos_memory_idx on public.photos (memory_id) where memory_id is not null;
create index photos_uploader_idx on public.photos (uploader_id, created_at desc);

-- 활성 커플 안에서 공유된 기록인가
create function private.memory_is_shared(p_memory_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memories m
    where m.id = p_memory_id and m.share_status = 'shared' and private.is_active_member(m.couple_id)
  );
$$;

-- 내가 쓴, 지정한 커플의 기록인가
create function private.is_my_memory(p_memory_id uuid, p_couple_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memories m
    where m.id = p_memory_id and m.couple_id = p_couple_id and m.author_id = auth.uid()
  );
$$;

-- 저장 경로 규칙: {couple_id}/{uploader_id}/{photo uuid}[_thumb].webp
create function private.valid_photo_path(p_path text, p_couple_id uuid, p_uploader_id uuid, p_thumb boolean)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_path ~ ('^' || p_couple_id::text || '/' || p_uploader_id::text || '/[0-9a-f-]{36}'
                   || case when p_thumb then '_thumb' else '' end || '\.webp$');
$$;

revoke all on function private.memory_is_shared(uuid), private.is_my_memory(uuid, uuid),
  private.valid_photo_path(text, uuid, uuid, boolean) from public, anon;
grant execute on function private.memory_is_shared(uuid), private.is_my_memory(uuid, uuid),
  private.valid_photo_path(text, uuid, uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 권한 · RLS
-- -----------------------------------------------------------------------------

revoke all on public.photos from public, anon, authenticated;
grant select, delete on public.photos to authenticated;
grant insert (couple_id, uploader_id, memory_id, storage_path, thumb_path, width, height, bytes,
              taken_at, taken_at_source, lat, lng, location_source, accuracy_m)
  on public.photos to authenticated;
grant update (memory_id, taken_at, taken_at_source, lat, lng, location_source, accuracy_m)
  on public.photos to authenticated;

alter table public.photos enable row level security;

create policy photos_select on public.photos for select to authenticated
  using (
    (uploader_id = (select auth.uid())
      and (private.is_active_member(couple_id) or private.in_archive(couple_id)))
    or (memory_id is not null and private.is_active_member(couple_id) and private.memory_is_shared(memory_id))
  );

create policy photos_insert on public.photos for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and private.is_active_member(couple_id)
    and private.valid_photo_path(storage_path, couple_id, uploader_id, false)
    and private.valid_photo_path(thumb_path, couple_id, uploader_id, true)
    and (memory_id is null or private.is_my_memory(memory_id, couple_id))
  );

create policy photos_update on public.photos for update to authenticated
  using (uploader_id = (select auth.uid()) and private.is_active_member(couple_id))
  with check (
    uploader_id = (select auth.uid())
    and private.is_active_member(couple_id)
    and (memory_id is null or private.is_my_memory(memory_id, couple_id))
  );

create policy photos_delete on public.photos for delete to authenticated
  using (uploader_id = (select auth.uid()) and private.is_active_member(couple_id));

-- -----------------------------------------------------------------------------
-- 파일 삭제 대기열
-- SQL에서는 저장소 파일을 직접 지울 수 없다(Storage API를 거쳐야 함). photos 행이 지워지면
-- 파일 경로를 대기열에 넣고, 서버 작업이 Storage API로 실제 파일을 지운다.
-- 행이 사라지는 즉시 아래 storage 정책에 의해 파일은 더 이상 읽을 수 없다.
-- -----------------------------------------------------------------------------

create table private.storage_deletion_queue (
  id        bigint generated always as identity primary key,
  bucket_id text not null,
  path      text not null,
  queued_at timestamptz not null default now()
);
revoke all on private.storage_deletion_queue from public, anon, authenticated;

create function private.queue_photo_files()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.storage_deletion_queue (bucket_id, path)
  values ('couple-photos', old.storage_path), ('couple-photos', old.thumb_path);
  return old;
end;
$$;

create trigger photos_queue_files after delete on public.photos
  for each row execute function private.queue_photo_files();

-- -----------------------------------------------------------------------------
-- Storage: 비공개 버킷 + 정책
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couple-photos', 'couple-photos', false, 10 * 1024 * 1024, array['image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 업로드: 내 활성 커플 / 내 폴더에만
create policy couple_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'couple-photos'
    and (storage.foldername(name))[1] = private.my_active_couple_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- 읽기: 내가 볼 수 있는 photos 행이 가리키는 파일만 (photos의 RLS가 그대로 적용된다).
-- 업로드 직후 photos 행을 만들기 전 짧은 시간 동안은 업로더 본인만 자기 파일을 읽을 수 있다.
create policy couple_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'couple-photos'
    and (
      exists (select 1 from public.photos p where p.storage_path = name or p.thumb_path = name)
      or ((storage.foldername(name))[2] = (select auth.uid())::text
          and created_at > now() - interval '15 minutes'
          and not exists (select 1 from public.photos p where p.storage_path = name or p.thumb_path = name)
          and (storage.foldername(name))[1] = private.my_active_couple_id()::text)
    )
  );

-- 삭제: 내가 올린 파일만
create policy couple_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'couple-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
