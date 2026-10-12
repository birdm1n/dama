# 데이터 모델 설계

✅ = 구현됨(`supabase/migrations`), 📝 = 설계만(다음 단계에서 마이그레이션 추가)

## 공통 규칙

- 모든 커플 데이터 테이블은 `couple_id`를 갖고 RLS로 `private.is_active_member(couple_id)`를 강제한다.
- 테이블 권한은 기본 회수 후 필요한 것만 부여한다. 상태 전이는 `SECURITY DEFINER` RPC로만 한다.
- 연결 해제된 커플(`status = 'dissolved'`, `purge_after > now()`)에서는 **본인이 작성한 행만** 읽기 전용으로 접근할 수 있다:
  `using (author_id = auth.uid() and private.was_member(couple_id) and <couple dissolved & not purged>)`
- 위치는 항상 `location_source`(`exif` | `device` | `manual` | `search`)와 `accuracy_m`을 함께 저장한다.
- 소프트 삭제(`deleted_at`)는 사용자 실수 복구용이다. 커플 영구 삭제 시에는 cascade로 모두 지운다.

## 인증·커플 ✅

| 테이블 | 주요 컬럼 | RLS 요약 |
|---|---|---|
| `profiles` | id(=auth.users.id), display_name, avatar_path | 본인 + 현재 활성 커플 상대만 조회. 수정은 본인 행의 display_name/avatar_path만 |
| `couples` | id, name, anniversary_on, status(active/dissolved), dissolved_at, purge_after | 활성 멤버 조회·이름/기념일 수정. 이전 멤버는 보관 기간 동안 해제된 커플 조회만 |
| `couple_members` | (couple_id, user_id), joined_at, left_at | 활성 커플 멤버 목록 + 본인 과거 행. 직접 쓰기 불가 |
| `couple_invites` | id, couple_id, token_hash, expires_at, used_at/by, revoked_at | 활성 멤버만 조회, `token_hash` 컬럼은 비노출 |

불변 조건(DB가 강제):
- 사용자당 활성 커플 1개 — 부분 유니크 인덱스 `couple_members(user_id) where left_at is null`
- 커플당 활성 멤버 최대 2명 — 트리거 `enforce_couple_capacity` (커플 행 잠금으로 동시 수락 방지)

RPC: `create_couple`, `create_invite`(24h, 1회용, 이전 초대 자동 취소, 시간당 10회 제한), `get_invite_preview`, `accept_invite`, `revoke_invite`, `leave_couple`.
정리 작업: `private.purge_dissolved_couples()` — pg_cron이 매일 실행.

## Couple Memory ✅

```
memories
  id, couple_id, author_id
  title (1~80자), body (≤5000자), happened_on date
  tags text[]          -- 최대 10개, 각 1~20자, 대소문자 무시 중복 불가 (private.valid_tags)
  share_status 'draft' | 'shared', shared_at (트리거가 서버 시각으로 설정)
  created_at, updated_at
  index: (couple_id, happened_on desc, created_at desc), gin(tags)
```

- 태그를 별도 테이블 대신 `text[]`로 둔 이유: 태그 이름이 기록과 **같은 가시성**을 갖는다. 상대가 볼 수 없는 초안의 태그 이름이 태그 목록으로 새지 않는다.
- RLS
  - 조회: 활성 멤버이고 (`shared` 이거나 내가 작성) / 또는 보관 중인 이전 커플에서 내가 작성.
  - 쓰기: `author_id = auth.uid()` + 활성 멤버. 수정·삭제·공유 전환은 작성자만.
  - 컬럼 권한: `couple_id`, `author_id`, `shared_at`은 수정 불가.
- 검색 `search_memories(q, tag, from, to, scope, limit, offset)` — SECURITY INVOKER라 호출자 RLS가 그대로 적용된다. 현재 활성 커플만 대상. 제목·본문·태그 부분 일치(ILIKE, `%`·`_` 이스케이프).
  한국어 형태소 사전이 없어 부분 일치로 충분하다고 판단. 커플당 기록 수가 많아지면 `pg_trgm` GIN 인덱스를 추가한다.
- `my_memory_tags()` — 필터 칩용 태그 목록(역시 RLS 적용).
- 삭제는 하드 삭제(확인 단계 있음).

## 사진 📝

```
photos
  id, couple_id, uploader_id
  storage_path               -- couple-photos/{couple_id}/{uploader_id}/{uuid}.{ext}
  taken_at timestamptz null, taken_at_source 'exif' | 'manual'
  lat, lng numeric null, location_source, accuracy_m
  width, height, bytes, mime
  review_status 'pending' | 'confirmed'   -- EXIF 추출값을 사용자가 확인하기 전엔 pending
  memory_id null references memories
  created_at, deleted_at
```

- 사진은 업로더만 보인다. **공유된 기록(`memories.share_status='shared'`)에 첨부된 사진만** 상대에게 보인다.
- Storage 버킷 `couple-photos`는 비공개. `storage.objects` 정책은 경로 첫 두 부분(couple_id, uploader_id)과 위 규칙으로 검사하고, 조회는 서명된 URL로만 한다.
- "비슷한 시간·장소 사진 묶음"은 저장하지 않고 클라이언트에서 계산해 **후보**로만 제시한다.
- 백그라운드 사진 감지는 브라우저에서 불가 → 사용자가 직접 고르는 업로드만 지원(정직한 구현).

## Memory Map 📝

```
places         id, couple_id, created_by, name, address, lat, lng, location_source, accuracy_m, created_at
memory_places  memory_id, place_id, seq int     -- 지도 연결선 순서. 실제 이동 경로가 아님(UI에 표시)
```

RLS는 `memories`와 같은 규칙(장소가 shared 기록에 연결되었거나 본인이 만든 경우).
좌표는 `numeric(9,6)`. 반경 검색이 필요해지면 PostGIS `geography(Point)`로 바꾼다.

## Date Discovery 📝

공개 게시물은 개인 기록을 참조하지 않는 **스냅샷 복사본**이다(개인 기록을 고쳐도 공개본으로 새지 않음). `couple_id`를 두지 않는다.

```
public_posts         id, author_id, kind 'place' | 'course', title, body,
                     status 'published' | 'hidden' | 'removed', created_at, updated_at
public_post_places   post_id, seq, name, address, lat, lng
public_post_images   post_id, seq, storage_path   -- 서버가 EXIF 제거·재인코딩한 사본만 (공개 버킷 public-posts)
post_likes           post_id, user_id, created_at, pk(post_id, user_id)
post_bookmarks       post_id, user_id, created_at, pk(post_id, user_id)
reports              id, post_id, reporter_id, reason, detail, status, created_at
user_blocks          blocker_id, blocked_id, created_at
```

RLS:
- `public_posts`: `published`이고 작성자를 내가 차단하지 않았으면 조회 가능. 작성·수정·삭제는 작성자 본인.
- 좋아요·북마크: 본인 행만 쓰기, 북마크는 본인만 조회.
- 신고: 본인 신고만 조회. 처리는 service_role(관리자)만.

## Storage 📝

| 버킷 | 공개 | 쓰기 | 읽기 |
|---|---|---|---|
| `couple-photos` | ✗ | 본인 경로(`{내 활성 couple_id}/{auth.uid()}/…`)에만 | 위 사진 규칙 + 서명된 URL |
| `public-posts` | ○ | 서버(EXIF 제거 처리 후)만 | 누구나 |
