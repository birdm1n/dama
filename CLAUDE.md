# DAMA (임시 서비스명)

커플이 함께한 추억을 기록하고, 지도에서 데이트 동선을 보고, 다른 커플이 공개한 데이트 장소·코스를 발견하는 웹 서비스.
데모가 아니라 실제 사용자가 쓸 제품이다. 데이터는 실제로 저장되고 권한은 서버/DB에서 검증되어야 한다.

## 핵심 기능
- **Couple Memory**: 둘만의 기록(사진, 메모, 날짜, 장소, 태그). 타임라인, 검색, 필터.
- **Memory Map**: 기록된 장소를 지도에 표시, 날짜별 코스 시각화.
- **Date Discovery**: 사용자가 직접 공개한 데이트 장소·코스 커뮤니티. 좋아요, 북마크, 신고·차단.
- **사진 업로드**: EXIF 촬영 시각·GPS 추출 → 사용자가 확인·수정 후 저장. 비슷한 시간·장소 사진을 기록 후보로 묶음.

## 원칙 (이유와 함께)
- **정직한 구현**: 브라우저로 안 되는 건(백그라운드 사진 감지 등) 된 척하지 말고 한계를 알리고 대안을 만든다. 사용자는 기능이 실제로 동작한다고 믿고 개인 데이터를 맡기기 때문.
- **프라이버시 우선**: 연인 간 사진·위치는 매우 민감하다.
  - 개인 기록이 커뮤니티에 자동 노출되면 안 된다. 공개는 항상 사용자의 명시적 선택.
  - 한 사람의 사진/위치를 상대에게 자동 공유하지 않는다. 공유는 승인 후.
  - 공개 게시물 이미지는 EXIF 위치를 제거한다.
  - 위치 데이터는 출처(EXIF / 기기 위치 / 수동)와 정확도를 구분해 저장한다.
  - 위치가 비슷하다고 "함께 있었다"고 단정하지 않고 후보로만 제시한다.
  - 지도의 장소 연결선은 실제 이동 경로가 아니라 기록 순서 기반임을 표시한다.
- **커플 간 데이터 격리**: 모든 커플 데이터는 couple_id 기준으로 RLS로 강제한다. 프런트 검증만으로는 부족하다. 비공개 사진은 인증된 접근만 가능하게.
- **AI 없음**: 초기 버전은 유료 AI API, RAG, 벡터 DB를 쓰지 않는다(비용). 검색은 PostgreSQL로 충분하다.
- **키 없이도 개발 가능**: 외부 API 키가 없어도 로컬에서 핵심 흐름이 동작해야 한다. 샘플 데이터는 샘플임이 드러나게.
- 비밀 키는 브라우저 노출·하드코딩 금지. `.env.example`로 문서화.

## 기술 스택 (기본안, 더 나은 근거가 있으면 제안)
Next.js + TypeScript, Tailwind, shadcn/ui, Supabase(Auth/Postgres/Storage/RLS), MapLibre GL JS, cloudflare

## 디자인
Pinterest 감성의 따뜻한 에디토리얼. 폴라로이드·스크랩북 카드, 넉넉한 여백, 부드러운 모서리. 예쁘되 유치하지 않게. 강한 그림자·과한 그라데이션 X. 모바일 우선.
토큰(한 곳에서 관리): bg #FAF7F2 / surface #FFFFFF / text #39352F / rose #D9AAA5 / sage #A8B49A / beige #EDE2D5 / border #E9E2D9
서비스명·로고(텍스트)는 설정 한 곳에서 바꿀 수 있게.

## 작업 방식
- 기능을 끝낼 때마다 테스트를 실행한다. 실패를 숨기지 않는다.
- 특히 커플 간 데이터 격리(RLS)는 반드시 테스트로 검증한다.
- 작업이 끝나면 짧게: 한 것 / 테스트 결과 / 남은 문제.

## 확정된 제품 결정
- **연결 해제**: 한쪽이 해제하면 커플은 `dissolved`. 상대의 기록·사진은 즉시 차단, 각자 **자기가 쓴 기록만** 30일간 읽기 전용 보관(내보내기 가능) 후 영구 삭제(`private.purge_dissolved_couples`, pg_cron 매일).
- **초대 링크**: `/invite#토큰`(fragment라 서버 로그에 안 남음), 24시간·1회용. 새로 발급하면 이전 미사용 링크 자동 취소. DB에는 토큰 sha256 해시만 저장. 로그인·가입 중에는 `src/features/couple/invite-token.ts`가 localStorage에 잠시 보관.
- **로그인**: 이메일+비밀번호, 이메일 인증 필수. 소셜 로그인은 나중에.
- 한 사람은 동시에 하나의 활성 커플에만 속한다. 커플은 최대 2명.
- **기록 공유**: 새 기록 기본값은 `draft`(나만 보기). `shared` 전환은 작성자만. 상대 기록은 읽기만. 태그는 `memories.tags text[]`(가시성이 기록과 같도록).
- **사진**: HEIC는 브라우저가 못 열면 `heic-to`(LGPL, 지연 로드)로 변환. EXIF는 브라우저에서 읽고 사용자가 확인한 값만 저장. 저장 파일은 WebP 재인코딩(EXIF 없음). 상대는 공유된 기록에 붙은 사진만 본다. 파일 삭제는 대기열 + `/api/cron/storage-cleanup`.
- **장소**: `memory_places`는 기록에 속한다(가시성 = 기록). 출처(exif/device/manual)·정확도 저장, manual은 정확도 없음. 지도 연결선은 기록 순서이며 지도 위 범례로 "실제 이동 경로 아님"을 항상 표시. 주소 검색 없음.
- **발견**: 공개 글은 기록의 사본(원본 참조·couple_id 없음), 공개 화면은 아무것도 선택 안 된 상태로 시작 + 확인 체크 필수. 작성자는 "익명의 커플". 이미지는 서버에서 WebP 메타데이터 청크를 한 번 더 제거해 비공개 버킷(`post-images`)에 두고 서명 URL로만. 차단은 양방향. 신고 3명 이상 → 자동 `under_review`. 운영자(`app_metadata.role='admin'`)가 `/admin/reports`에서 복구/내리기(`removed`), 기록은 `private.moderation_log`. 서명 URL은 10분.
- 지도: MapLibre(`src/features/map/map-view.tsx`), 워커 파일은 `scripts/copy-vendor.mjs`가 `public/vendor/`로 복사(빌드·dev 전에 자동, HEIC 워커 포함). 배경 스타일 실패 시 단색 배경으로 대체.
- **회원 탈퇴**: `/settings`에서 비밀번호 재확인 + 확인 문구 → 활성 커플이면 연결 해제 → Auth Admin API로 계정 삭제(DB는 CASCADE, 파일은 대기열). 탈퇴 전 `/settings/export`로 내 데이터 JSON. **service_role은 파일 정리 작업과 회원 탈퇴 두 곳에서만** 쓴다.
- **비밀번호 재설정**: 브라우저에서 호출, 가입 여부와 관계없이 같은 안내, 링크는 요청한 브라우저에서(PKCE).
- 샘플 데이터는 `supabase/seed.sql`(로컬 전용, 모든 이름·제목에 `[샘플]`).

## 코드 지도
- 디자인 토큰: `src/app/globals.css`의 `@theme` (유일한 출처) / 서비스명·로고: `src/config/site.ts`
- DB: `supabase/migrations/*.sql` — 전체 기능 스키마 설계는 `docs/schema.md`
- Supabase 클라이언트: `src/lib/supabase/{server,proxy,env}.ts`, 세션 갱신·보호 경로: `src/proxy.ts` (Next 16에서 middleware → proxy)
- 기능별 코드: `src/features/<기능>/{actions,queries,components}.ts(x)`
- Next.js 16은 학습 데이터와 API가 다를 수 있다. `AGENTS.md`와 `node_modules/next/dist/docs/`를 먼저 확인.

## 배포·도구
- Cloudflare Workers(`@opennextjs/cloudflare`, `wrangler.jsonc`, 진입점 `worker.ts` — 크론이 파일 정리 라우트를 호출). `npm run cf:preview`로 로컬 workerd 실행.
- `patches/@opennextjs+cloudflare+1.20.7.patch`(Next 16.4 `preview-props.json` 누락 수정)를 `patch-package`가 적용한다. OpenNext 버전을 올릴 때 패치가 아직 필요한지 확인.
- OpenNext는 `.env.local` 등을 워커 번들(`next-env.mjs`)에 넣는다 → `scripts/sanitize-next-env.mjs`가 빌드 후 `NEXT_PUBLIC_*`만 남긴다(cf:build·cf:deploy에 연결). 배포는 원격 Supabase 주소를 환경 변수로 주고 `npm run cf:deploy`(로컬 주소면 중단). 서버 비밀값은 `wrangler secret put`으로만. 배포 주소: `https://dama.me.kr`(Workers Custom Domain, www는 `worker.ts`에서 301; 이전용 `dama.dama-app.workers.dev`도 유지). DNS는 Cloudflare 존 `dama.me.kr`(Resend 발송 레코드 포함).
- DB 타입: 마이그레이션을 바꾸면 `npm run gen:types`(로컬 Supabase 필요)로 `src/lib/supabase/database.types.ts`를 다시 만든다. Supabase 클라이언트는 이 타입으로 검사된다.

## 보안 규칙 (점검 결과는 `docs/security.md`)
- CSP는 `src/lib/security/csp.ts`(proxy에서 요청별 nonce). 새 외부 출처(API·이미지·지도)를 쓰면 여기에 추가하고, `eval`이 필요한 라이브러리는 페이지가 아니라 전용 워커로 격리한다(HEIC 디코더 참고, 워커 CSP는 `next.config.ts`와 `public/_headers` 둘 다).
- zod는 `@/lib/zod`에서 가져온다(`jitless` 설정 — CSP 위반 방지).
- 로그인·가입은 브라우저에서 Supabase를 직접 호출한다(IP 단위 rate limit 때문). 서버 액션으로 옮기지 말 것.
- 권한 우회 RPC(SECURITY DEFINER)를 추가하면 `tests/db/security-invariants.test.ts`의 검토 목록을 갱신해야 테스트가 통과한다.

## DB 작성 규칙
- public 스키마 새 테이블: **RLS 켜기 + `revoke all ... from public, anon, authenticated` 후 필요한 권한만 grant**. (Supabase는 기본으로 anon/authenticated에 전부 grant한다. `tests/db/rls-isolation.test.ts`가 RLS 누락을 잡는다.)
- 상태 전이·다른 사용자 행을 건드리는 작업은 `SECURITY DEFINER` + `set search_path = ''` RPC로. 오류는 대문자 코드(`raise exception 'INVITE_EXPIRED'`)로 던지고 `src/features/couple/errors.ts`에 문구 추가(단위 테스트가 누락을 잡는다).
- RLS 헬퍼는 API에 노출되지 않는 `private` 스키마에.

## 테스트
- `npm run test:unit` — 단위
- `npm run test:db` — RLS·RPC. Docker 없이 임시 Postgres + `tests/db/supabase-shim.sql`로 실행. `DATABASE_URL`을 주면 그 DB(예: supabase start의 54322)에 대해 실행.
- `npm run test:e2e` — Playwright. `supabase start` + `.env.local` 필요, 메일은 Mailpit(54324)에서 읽음. 정리 작업 테스트는 `SUPABASE_SERVICE_ROLE_KEY`·`CRON_SECRET`이 있을 때만 실행.
- 사진 테스트 픽스처(`tests/fixtures/*.jpg`)는 EXIF 값(시각·오프셋·GPS·정확도)을 알고 있는 합성 이미지다.
- `npm run lint`, `npm run typecheck`, `npm run build`
