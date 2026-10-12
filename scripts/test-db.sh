#!/usr/bin/env bash
# DB(RLS·RPC) 테스트 실행기.
#
#  * DATABASE_URL이 있으면 그 DB에 대해 바로 실행한다.
#    예) supabase start 후:  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#  * 없으면 Docker 없이 임시 PostgreSQL 클러스터를 띄우고 Supabase 흉내(shim) + 마이그레이션을 적용한 뒤
#    테스트하고 정리한다. (PostgreSQL 15+ 바이너리 필요: initdb, pg_ctl)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -n "${DATABASE_URL:-}" ]]; then
  exec npx vitest run --project db "$@"
fi

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}"
if [[ ! -x "$PG_BIN/initdb" ]]; then
  echo "initdb를 찾을 수 없습니다. PostgreSQL을 설치하거나 DATABASE_URL을 지정하세요." >&2
  exit 1
fi

PORT="${TEST_PG_PORT:-54329}"
WORK="$(mktemp -d)"
DATA="$WORK/data"

# PostgreSQL은 root로 실행할 수 없으므로 root라면 postgres 사용자로 실행한다.
run_pg() {
  if [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

if [[ "$(id -u)" == "0" ]]; then chown postgres "$WORK"; fi

cleanup() {
  run_pg "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_pg "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
run_pg "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $WORK -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" -w start >/dev/null

PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "create database dama_test" >/dev/null
"${PSQL[@]}" -d dama_test -f "$ROOT/tests/db/supabase-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d dama_test -f "$f" >/dev/null
done

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/dama_test"
npx vitest run --project db "$@"
