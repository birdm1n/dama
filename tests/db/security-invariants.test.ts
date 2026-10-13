import { describe, it, expect } from "vitest";
import { withTx, expectDbError, insertPhoto } from "./helpers";

/**
 * 보안 불변식 — 새 마이그레이션이 규칙을 어기면 여기서 실패한다.
 * (CLAUDE.md "DB 작성 규칙"을 사람이 기억하지 않아도 되게)
 */
describe("보안 불변식 (DB 카탈로그 검사)", () => {
  it("public 테이블에 anon/PUBLIC 권한이 없다", () =>
    withTx(async (db) => {
      const rows = await db.admin(
        `select table_name, privilege_type from information_schema.role_table_grants
          where grantee in ('anon', 'PUBLIC') and table_schema = 'public'`,
      );
      expect(rows).toEqual([]);
    }));

  it("public 함수는 anon이 실행할 수 없다", () =>
    withTx(async (db) => {
      const rows = await db.admin(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`,
      );
      expect(rows).toEqual([]);
    }));

  it("모든 SECURITY DEFINER 함수는 search_path를 고정한다", () =>
    withTx(async (db) => {
      const rows = await db.admin(
        `select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('public', 'private') and p.prosecdef
            and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
      );
      expect(rows).toEqual([]);
    }));

  it("authenticated가 부를 수 있는 SECURITY DEFINER 함수는 검토된 목록뿐이다", () =>
    withTx(async (db) => {
      const rows = await db.admin<{ proname: string }>(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
          order by 1`,
      );
      // 새 함수를 추가했다면: 호출자 검증(auth.uid(), 권한 확인)을 리뷰한 뒤 이 목록에 넣는다
      expect(rows.map((r) => r.proname)).toEqual([
        "accept_invite", "admin_report_queue", "create_couple", "create_invite",
        "get_invite_preview", "leave_couple", "moderate_post", "revoke_invite",
      ]);
    }));

  it("모든 public 테이블은 RLS가 켜져 있고 정책은 authenticated 대상이며 무조건 허용(true)이 없다", () =>
    withTx(async (db) => {
      const noRls = await db.admin(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      );
      expect(noRls).toEqual([]);
      const loose = await db.admin(
        `select tablename, policyname from pg_policies
          where schemaname = 'public'
            and (not ('authenticated' = any (roles)) or qual = 'true' or with_check = 'true')`,
      );
      expect(loose).toEqual([]);
    }));

  it("우리 storage 정책도 authenticated 대상이고, 버킷은 모두 비공개이며 WebP·10MB로 제한된다", () =>
    withTx(async (db) => {
      const loose = await db.admin(
        `select policyname from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and (policyname like 'couple_photos_%' or policyname like 'post_images_%')
            and not ('authenticated' = any (roles))`,
      );
      expect(loose).toEqual([]);
      const buckets = await db.admin<{ id: string; public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
        "select id, public, file_size_limit::text, allowed_mime_types from storage.buckets order by id",
      );
      for (const b of buckets) {
        expect(b.public, b.id).toBe(false);
        expect(Number(b.file_size_limit), b.id).toBeLessThanOrEqual(10 * 1024 * 1024);
        expect(b.allowed_mime_types, b.id).toEqual(["image/webp"]);
      }
    }));

  it("private 스키마의 테이블은 클라이언트 역할이 읽을 수 없고, anon은 스키마에 접근할 수 없다", () =>
    withTx(async (db) => {
      const grants = await db.admin(
        `select table_name, grantee from information_schema.role_table_grants
          where table_schema = 'private' and grantee in ('anon', 'authenticated', 'PUBLIC')`,
      );
      expect(grants).toEqual([]);
      const [{ anon }] = await db.admin<{ anon: boolean }>("select has_schema_privilege('anon', 'private', 'usage') as anon");
      expect(anon).toBe(false);
    }));

  it("민감한 컬럼은 클라이언트가 읽거나 쓸 수 없다", () =>
    withTx(async (db) => {
      const priv = async (table: string, column: string, p: string) => {
        const [{ ok }] = await db.admin<{ ok: boolean }>("select has_column_privilege('authenticated', $1, $2, $3) as ok", [
          `public.${table}`, column, p,
        ]);
        return ok;
      };
      expect(await priv("couple_invites", "token_hash", "SELECT")).toBe(false);
      for (const [t, c] of [
        ["memories", "author_id"], ["memories", "couple_id"], ["memories", "shared_at"],
        ["photos", "uploader_id"], ["photos", "couple_id"], ["photos", "storage_path"],
        ["public_posts", "author_id"], ["public_posts", "like_count"], ["public_posts", "bookmark_count"],
        ["couples", "status"], ["couple_members", "left_at"], ["profiles", "avatar_path"],
      ]) {
        expect(await priv(t, c, "UPDATE"), `${t}.${c}`).toBe(false);
      }
    }));
});

describe("남용 방지", () => {
  it("하루 사진 300장, 기록 200개를 넘길 수 없다", () =>
    withTx(async (db) => {
      const [a, b] = await db.createUsers("Ana", "Ben");
      const x = await db.pair(a, b);
      await db.admin(
        `insert into memories (couple_id, author_id, title, happened_on)
         select $1::uuid, $2::uuid, 't' || g, current_date from generate_series(1, 200) g`,
        [x, a.id],
      );
      await expectDbError(
        db.as(a, "insert into memories (couple_id, author_id, title, happened_on) values ($1, $2, 'x', current_date)", [x, a.id]),
        "DAILY_LIMIT",
      );
      await db.admin(
        `insert into photos (couple_id, uploader_id, storage_path, thumb_path, width, height, bytes)
         select $1::uuid, $2::uuid, $1::text || '/' || $2::text || '/' || gen_random_uuid() || '.webp',
                $1::text || '/' || $2::text || '/' || g || '_t', 1, 1, 1
         from generate_series(1, 300) g`,
        [x, a.id],
      );
      await expectDbError(insertPhoto(db, a, x), "DAILY_LIMIT");
      // 다른 사용자에게는 영향 없음
      await insertPhoto(db, b, x);
    }));
});
