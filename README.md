# DAMA

커플이 함께한 추억을 기록하고, 지도에서 데이트 동선을 돌아보는 웹 서비스. (서비스명은 임시 — `src/config/site.ts`)

현재 구현 범위
- 회원가입·로그인(이메일 인증), 커플 공간 생성, 24시간·1회용 초대 링크로 연결, 연결 해제(30일 보관 후 삭제)
- 기록: 작성·수정·삭제, 월별 타임라인, 검색·태그·기간·공개범위 필터, 초안(나만 보기) ↔ 공유 전환, 해제 후 보관함·JSON 내보내기
- 공통 레이아웃·디자인 토큰

사진·지도·발견은 아직 없다. 전체 스키마 설계는 [`docs/schema.md`](docs/schema.md).

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

## 배포 (계획)

Cloudflare Workers + `@opennextjs/cloudflare`, Supabase 호스팅 프로젝트. 아직 설정하지 않았다.
배포 시 `NEXT_PUBLIC_SITE_URL`과 Supabase Auth의 Site URL / Redirect URLs(`https://도메인/**`)를 맞춰야 한다.
