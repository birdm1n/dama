# DAMA

커플이 함께한 추억을 기록하고, 지도에서 데이트 동선을 돌아보는 웹 서비스. (서비스명은 임시 — `src/config/site.ts`)

현재 구현 범위
- 회원가입·로그인(이메일 인증), 커플 공간 생성, 24시간·1회용 초대 링크로 연결, 연결 해제(30일 보관 후 삭제)
- 기록: 작성·수정·삭제, 월별 타임라인, 검색·태그·기간·공개범위 필터, 초안(나만 보기) ↔ 공유 전환, 해제 후 보관함·JSON 내보내기
- 사진: 여러 장 선택 → EXIF 촬영 시각·위치 확인/수정/제거 → 비슷한 시간·장소끼리 기록 후보 제안 → 업로드(위치 정보 없는 WebP로 재인코딩), 기록에 붙이기, 내 사진함
- 지도: 기록에 장소 추가(지도에서 고르기 / 사진 위치 / 현재 위치 / 좌표 입력), 전체 장소 보기, 날짜별 코스(기록 순서 점선 — 실제 이동 경로 아님을 표시)
- 발견: 내 기록에서 고른 글·사진·장소만 사본으로 공개(익명), 피드·검색·코스/장소 필터, 좋아요·저장, 신고(3명 이상 신고 시 자동 숨김), 작성자 차단(양방향), 숨기기·삭제
- 공통 레이아웃·디자인 토큰

### 브라우저 한계 (정직하게)
- 새로 찍은 사진을 자동으로 감지할 수 없다. 사용자가 직접 고른다.
- 브라우저가 HEIC를 직접 열지 못하면 libheif(WebAssembly, `heic-to`)로 변환한다. 약 3MB라 HEIC를 만났을 때만 불러온다.
- 주소·장소 검색은 없다. 지도에서 직접 고르거나 사진·현재 위치를 쓴다.
- 지도 배경은 OpenFreeMap 타일을 브라우저가 직접 받는다. 타일 서버는 사용자가 보고 있는 지역을 알 수 있다(기록 내용은 전달되지 않는다). `NEXT_PUBLIC_MAP_STYLE_URL`로 다른 제공처로 바꿀 수 있다.
- WebGL을 지원하지 않는 브라우저에서는 지도 대신 장소 목록만 보인다. 전체 스키마 설계는 [`docs/schema.md`](docs/schema.md).

## 로컬 실행 (외부 API 키 불필요)

필요: Node 20+, Docker(Supabase 로컬용)

```bash
npm install
npx supabase start          # Postgres/Auth/Storage/Mailpit 실행 + 마이그레이션 적용
npx supabase status         # API URL, Publishable key 확인
cp .env.example .env.local  # 위 값 입력
npm run dev                 # http://127.0.0.1:3000
```

- 가입 인증 메일은 실제로 발송되지 않고 Mailpit(http://127.0.0.1:54324)에 쌓인다.
- 샘플 계정(`supabase/seed.sql`, 로컬에서만 적용): `sample-a@dama.local` / `sample-b@dama.local`, 비밀번호 `sample1234`. 이미 커플로 연결되어 있고 `[샘플]` 기록이 들어 있다.
- 두 계정 연결을 직접 해보려면 브라우저 창 두 개(일반 + 시크릿)를 쓴다.

## 테스트

| 명령 | 내용 | 필요 환경 |
|---|---|---|
| `npm run test:unit` | 입력 검증, 리다이렉트 안전성, 오류 문구 | 없음 |
| `npm run test:db` | **커플 간 데이터 격리(RLS)**, 초대·수락·해제 규칙 | PostgreSQL 바이너리(Docker 불필요) 또는 `DATABASE_URL` |
| `npm run test:e2e` | 두 계정 가입→인증→커플 연결→제3자 차단→해제, 기록 공유 규칙·검색·보관함 내보내기 (브라우저 + 실제 API) | `supabase start` + `.env.local` |

`npm run test:db`는 `DATABASE_URL`이 없으면 임시 Postgres 클러스터를 띄워 Supabase 흉내(`tests/db/supabase-shim.sql`)와 마이그레이션을 적용해 테스트한다.
실제 Supabase DB로 돌리려면: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`

## 운영
- 신고가 3건 이상 쌓인 글은 자동으로 `under_review`가 되어 숨겨진다.
- 운영자는 `/admin/reports`에서 미처리 신고를 보고 **복구**(다시 공개, 신고 기각) 또는 **내리기**(`removed`)를 한다. 결정은 `private.moderation_log`에 남는다.
- 운영자 지정: 사용자가 바꿀 수 없는 `app_metadata.role = 'admin'`. service_role로만 설정할 수 있다(설정 후 다시 로그인).
  ```ts
  await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role: "admin" } })
  ```
  로컬에서는 Studio(http://127.0.0.1:54323) → Authentication에서도 바꿀 수 있다.

## 서드파티 라이선스
- `heic-to`(libheif)는 **LGPL-3.0**이다. 앱 번들과 분리된 파일로 지연 로드되어 교체 가능하다. 배포 전에 라이선스 고지 방식을 확인할 것.
- MapLibre GL JS(BSD-3), exifr(MIT), 지도 타일 OpenFreeMap/OpenStreetMap(ODbL, 지도에 출처 표시).

## 정기 작업

| 작업 | 방법 |
|---|---|
| 해제 후 30일 지난 커플 데이터 삭제 | DB의 pg_cron이 매일 `private.purge_dissolved_couples()` 실행 (마이그레이션이 등록) |
| 삭제된 사진·공개 글 이미지 파일 정리 | 스케줄러가 `POST /api/cron/storage-cleanup` 호출 (`Authorization: Bearer $CRON_SECRET`, 서버에 `SUPABASE_SERVICE_ROLE_KEY` 필요) |

## 배포 (Cloudflare Workers + Supabase)

Cloudflare Workers에서 `@opennextjs/cloudflare`로 실행한다. 로컬에서 Cloudflare 런타임(workerd)으로 전체 E2E를 돌려 확인했다(실제 Cloudflare 계정 배포는 아직 안 함).

1. **Supabase 프로젝트**: `npx supabase link` → `npx supabase db push`로 마이그레이션 적용.
   - Auth → URL Configuration: Site URL = 배포 주소, Redirect URLs에 `https://<도메인>/**` 추가.
   - Auth → 이메일 인증 켜기, SMTP 설정(기본 메일 발송은 개수 제한이 있다).
   - Database → Extensions에서 `pg_cron` 켜기(해제된 커플 30일 후 삭제 스케줄은 마이그레이션이 등록한다. 켜기 전에 마이그레이션을 적용했다면 `select cron.schedule('purge-dissolved-couples', '17 3 * * *', 'select private.purge_dissolved_couples()');`를 한 번 실행).
2. **빌드 환경변수**(CI): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. `NEXT_PUBLIC_*`는 빌드할 때 코드에 들어가므로 **빌드 시점**에 있어야 한다.
3. **런타임 비밀값**(서버 전용, 커밋 금지):
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # 파일 정리 작업에만 사용
   npx wrangler secret put CRON_SECRET                  # 16자 이상 임의 문자열
   ```
4. **배포**: `npm run cf:deploy` (`wrangler.jsonc`의 `name`이 워커 이름).
5. **정기 작업**: `wrangler.jsonc`의 Cron Trigger(매시 17분)가 `worker.ts`의 `scheduled`에서 같은 워커 안의 `/api/cron/storage-cleanup`을 호출해 삭제된 사진·공개 글 이미지 파일을 지운다. 외부 스케줄러는 필요 없다.

로컬에서 Cloudflare 런타임으로 확인: `.dev.vars.example`을 `.dev.vars`로 복사해 값을 채우고 `npm run cf:preview` (http://127.0.0.1:8787). 크론은 `npx wrangler dev --test-scheduled` 후 `curl "http://127.0.0.1:8787/__scheduled?cron=17+*+*+*+*"`.

### 알아둘 점
- **OpenNext 패치**: `@opennextjs/cloudflare` 1.20.7은 Next 16.4가 새로 읽는 `preview-props.json`을 워커에 넣지 않아 모든 페이지가 500이 된다. `patches/`의 한 줄 패치를 `patch-package`가 설치 때 적용한다(버전은 정확히 고정). 상위 버전에서 고쳐지면 패치를 지우고 버전을 올린다.
- Next 16의 `proxy.ts`(세션 갱신·보호 경로)는 Node.js 런타임에서만 돈다. OpenNext는 Cloudflare에서의 Node 미들웨어를 "실험적"이라고 표시한다. 로컬 workerd에서 로그인·세션 유지를 포함한 E2E는 모두 통과했다.
- 모든 페이지가 로그인 사용자별로 동적이라 ISR/증분 캐시(R2)는 쓰지 않는다.
- `npm audit`에 남은 경고(`braces`)는 ESLint 설정·patch-package 등 개발 도구 의존성이며 배포 번들에는 포함되지 않는다.
