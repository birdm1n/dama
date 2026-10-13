# 보안·권한 점검 (배포 전)

점검일: 2026-10-13. 로컬 Supabase 호환 스택(실제 GoTrue·PostgREST·Storage)과 Cloudflare 런타임(workerd)에서 확인했다.

## 자동으로 지켜지는 것 (테스트)

| 영역 | 확인 방법 |
|---|---|
| 커플 간 격리, 공유·초안, 보관, 발견·차단·신고, 운영 권한 | `tests/db/*.test.ts` (실제 Supabase 스키마에서도 실행) |
| **DB 보안 불변식** — anon 권한 없음, anon이 public 함수 실행 불가, 모든 SECURITY DEFINER에 `search_path` 고정, 권한 우회 RPC는 검토된 8개뿐, 모든 public 테이블 RLS + `authenticated` 대상 + `using(true)` 없음, 버킷 비공개·WebP·10MB, private 스키마 비노출, 민감 컬럼(token_hash·author_id·couple_id·카운트 등) 쓰기 불가 | `tests/db/security-invariants.test.ts` — 새 마이그레이션이 규칙을 어기면 실패 |
| 남용 방지 — 하루 사진 300장·기록 200개·공개 글 10개·신고 20회, 시간당 초대 10회 | DB 트리거 + 테스트 |
| CSP — 요청별 nonce, 인라인 스크립트 전부 nonce, 404 포함, 주요 화면(가입·HEIC·사진·지도·발견)에서 위반 0 | `tests/e2e/security.spec.ts` (Node 서버·workerd 양쪽) |
| 인증 — 계정 존재 여부 비노출(로그인·가입), 오픈 리다이렉트 차단 | `tests/e2e/security.spec.ts`, `tests/unit/safe-redirect.test.ts` |

## 이번 점검에서 고친 것

| 문제 | 영향 | 조치 |
|---|---|---|
| OpenNext가 `.env.local`을 워커 번들에 넣음 | 로컬 service_role 키·CRON_SECRET이 배포본에 포함, 워커 비밀값을 빠뜨리면 로컬 값이 조용히 쓰임 | 빌드 후 `scripts/sanitize-next-env.mjs`가 `NEXT_PUBLIC_*`만 남김. 배포 빌드가 로컬 Supabase를 가리키면 중단 |
| CSP 없음 | Supabase 세션 쿠키는 브라우저 클라이언트가 읽어야 해서 httpOnly가 아니다. XSS 한 번이면 토큰 유출 | nonce 기반 CSP(`src/lib/security/csp.ts`, proxy에서 적용). 스크립트는 nonce+`strict-dynamic`, 데이터 전송은 self·Supabase·지도 서버로 제한, `frame-ancestors 'none'`, HTTPS면 HSTS·`upgrade-insecure-requests` |
| HEIC 디코더가 `eval` 사용 | 페이지에 `unsafe-eval`을 허용하면 CSP가 크게 약해짐 | 디코더를 전용 워커(`/vendor/heic/heic-worker.mjs`)로 격리하고 그 경로에만 별도 CSP(eval 허용·네트워크 차단). 워커는 DOM·쿠키 접근 불가 |
| zod의 `Function("")` 탐지 | 매 페이지 CSP 위반 보고(실제 공격 탐지를 가림) | `z.config({ jitless: true })` (`src/lib/zod.ts`) |
| **로그인·가입을 서버에서 호출** | Supabase Auth의 로그인·가입 제한은 IP 단위(기본 5분 30회). 워커 IP로 몰려 **전체 사용자가 로그인 불가**해질 수 있음 | 브라우저에서 직접 호출(`src/features/auth/client-auth.ts`) |
| `profiles.avatar_path` 쓰기 가능 | 아바타 기능이 없는데 임의 경로 저장 가능(향후 서명 URL 경로 조작 위험) | 권한 회수(기능을 만들 때 경로 검증과 함께 다시 연다) |
| 생성 개수 제한 없음 | 한 계정이 저장소·DB를 채울 수 있음 | 하루 사진 300장·기록 200개 제한 |
| `X-Powered-By` 노출 | 프레임워크 정보 노출 | 끔 |
| 비밀번호 변경 시 재인증 꺼짐 | 세션 탈취 시 비밀번호까지 바뀔 수 있음 | `secure_password_change = true` |

## 회원 탈퇴·비밀번호 재설정
- **탈퇴**(`/settings`, `src/features/account/actions.ts`): 대상 사용자는 검증된 세션에서만 정한다 → 비밀번호 재확인(세션을 남기지 않는 별도 클라이언트) + 확인 문구 → 활성 커플이면 `leave_couple`(상대는 자기 기록 30일 보관) → Auth Admin API로 계정 삭제. DB는 ON DELETE CASCADE로 기록·사진·장소·공개 글·좋아요·저장·신고·차단을 지우고, 사진·공개 이미지 파일은 삭제 대기열로(정리 작업이 지움). `tests/db/account-deletion.test.ts`, `tests/e2e/account.spec.ts`.
- 탈퇴 전 **내 데이터 내려받기**(`/settings/export`, JSON): 내가 쓴 기록(현재·보관)·장소·사진 정보·공개 글. 사진 파일은 포함하지 않는다.
- **비밀번호 재설정**: 브라우저에서 `resetPasswordForEmail` → 메일 링크(PKCE, 요청한 브라우저에서 열어야 함) → `/reset-password`에서 새 비밀번호. 가입 여부와 관계없이 같은 안내. 설정의 "비밀번호 변경"도 같은 메일 흐름(본인 확인).

## 검토했고 문제없음
- service_role은 두 곳에서만 쓴다: 파일 정리 작업(`/api/cron/storage-cleanup`, 비밀값 16자 이상·상수 시간 비교)과 회원 탈퇴(세션에서 확인한 본인 계정만, 비밀번호 재확인 후).
- 모든 서버 액션·라우트는 사용자 세션(RLS)으로 동작. 리다이렉트에 쓰는 id는 DB 갱신 성공 후의 값(uuid·RLS 통과).
- 권한 우회 RPC 8개(초대·커플·운영): 호출자 검증, 행 잠금으로 동시 수락 경쟁 차단, 운영자 확인(`app_metadata`는 사용자가 못 바꿈).
- 이메일 인증 콜백은 PKCE(같은 브라우저의 코드 검증 쿠키 필요) → 로그인 CSRF 불가.
- 추적되는 파일에 비밀값 없음(`.env.local`, `.dev.vars` 무시). seed의 샘플 비밀번호는 로컬 `db reset`에서만 적용(`db push`는 seed를 실행하지 않음).
- `dangerouslySetInnerHTML`·`eval` 사용 없음. 사용자 입력은 React가 이스케이프.
- 저장된 사진은 브라우저 재인코딩으로 EXIF 없음, 공개 이미지는 서버에서 메타데이터 청크를 한 번 더 제거.

## 원격 프로젝트 (2026-10-13 적용)
- Supabase 프로젝트 `dama`(ref `vxagkezfynlgmgcqyrtg`, 서울, Free 요금제). 마이그레이션 0001~0009 적용, seed 미적용.
- 적용 직후 확인: public 테이블 14개 모두 RLS, anon 테이블 권한·함수 실행 0, 버킷 2개 모두 비공개, SECURITY DEFINER 전부 `search_path` 고정, pg_cron 작업(`purge-dissolved-couples`) 등록.
- 보안 점검(advisor): 경고 8건 = 검토된 권한 우회 RPC 8개(로그인 사용자가 호출하는 게 의도). 그 외 없음.
- 성능 점검: FK 인덱스 누락 5건 → 0009로 추가. "사용 안 된 인덱스"는 데이터가 없어서 나온 것. 운영자 정책이 SELECT 정책과 OR로 합쳐지는 경고 2건은 의도.
- 원격 격리 확인(트랜잭션 안에서 실행 후 롤백, 흔적 없음): 커플 A의 상대 B는 공유 기록만 보고 초안은 못 봄. 다른 커플 C는 A 커플의 기록·커플·프로필을 0건 조회, A 커플에 기록 삽입은 RLS 거부, 전체 UPDATE는 0행, 사용된 초대 재사용은 `INVITE_USED`. 권한 점검: anon은 public 테이블 권한·private 스키마 접근 없음, `claim_storage_deletions`는 service_role만, `token_hash`·`avatar_path`·`author_id`·`like_count` 쓰기/읽기 불가.
- 마이그레이션 이력: MCP로 적용해 원격 버전 번호가 로컬 파일명과 다르고, 0007은 `moderation` + `moderation_status_removed` 두 개로 나뉘어 있다(내용은 같음). 나중에 `supabase db push`를 쓰려면 먼저 `supabase migration repair`로 이력을 로컬 버전에 맞춘다.

## 운영 설정 체크리스트 (Supabase 대시보드)
- [ ] Auth → URL: Site URL·Redirect URLs를 배포 도메인으로(와일드카드는 자기 도메인만)
- [ ] Auth → 이메일 인증 켜기, 커스텀 SMTP
- [ ] Auth → 비밀번호: 최소 8자 + 영문·숫자, **유출 비밀번호 차단(HIBP)** 켜기
- [ ] Auth → 비밀번호 변경 시 재인증(secure password change) 켜기
- [ ] Auth → Rate limits: **토큰 갱신(token refresh)** 한도를 사용자 수에 맞게 올리기 — 세션 갱신은 서버(워커)에서 일어나 IP 단위 한도를 나눠 쓴다(아래 참고)
- [ ] Database → `pg_cron` 켜기(해제 커플 30일 후 삭제)
- [ ] API 설정에서 노출 스키마가 `public`(필요하면 `graphql_public`)뿐인지 확인 — `private`이 노출되면 안 된다
- [ ] 운영자 계정만 `app_metadata.role = 'admin'`
- [ ] Cloudflare: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`; 로그 보존 기간 확인

## 남은 위험·미구현 (배포 판단 필요)
1. ~~회원 탈퇴 없음~~ → **구현함**(아래 "회원 탈퇴").
2. ~~비밀번호 재설정 없음~~ → **구현함**(브라우저에서 호출, 계정 존재 비노출).
3. **토큰 갱신의 IP 한도** — proxy에서 세션을 갱신하므로 Supabase는 워커 IP를 본다. 기본 한도(5분 150회/IP)를 넘으면 일부 사용자의 세션이 풀린다. 대시보드에서 한도를 올리고 지켜봐야 한다.
4. ~~초대 토큰이 URL 경로에 있다~~ → **고침**: 링크가 `/invite#토큰`. fragment는 서버로 전송되지 않아 요청 로그·Referer에 남지 않는다. 브라우저가 토큰을 읽어 서버 액션 본문(POST)으로만 보내고 주소창에서 지운다. 로그인·가입·메일 인증 동안은 같은 브라우저 localStorage에 24시간 만료로 보관, 수락·무효 시 삭제. E2E가 "어떤 요청 URL에도 토큰이 없음"을 검사한다.
5. **이미 발급된 서명 URL** — 숨김·차단·공유 해제 후에도 최대 10분은 열린다(취소 불가).
6. **업로드 파일 내용 검증** — 비공개 사진은 MIME(WebP)과 크기만 Storage가 확인한다. 사진은 커플 둘만 보고 다른 도메인(Supabase)에서 서빙되어 위험은 낮다. 공개 이미지는 서버에서 WebP 구조를 파싱해 검증한다.
7. **Node 미들웨어(proxy)** — OpenNext가 Cloudflare에서 "실험적"으로 표시. 로컬 workerd E2E는 통과.
8. ~~LGPL 고지~~ → `/licenses` 화면(로그인·설정에서 링크)과 `/vendor/heic/LICENSE.txt`로 고지. heic-to는 분리된 파일이라 교체 가능.
9. **`npm audit`** — `braces`(ESLint 설정·patch-package, 개발 도구만). 배포 번들에 없음.
