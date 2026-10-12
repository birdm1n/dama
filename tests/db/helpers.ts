import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * DB 테스트 헬퍼.
 *
 * 각 테스트는 하나의 트랜잭션 안에서 실행되고 끝나면 ROLLBACK 된다.
 * 사용자 행동은 `as(user, ...)` 안에서 실제 Supabase와 동일하게
 * `authenticated` 역할 + request.jwt.claims 로 실행되므로 RLS가 그대로 적용된다.
 * 셋업(사용자 생성, 시간 조작)은 슈퍼유저로 한다.
 */

export type TestUser = { id: string; email: string; name: string };

export class Db {
  constructor(private client: Client) {}

  /** 슈퍼유저(RLS 우회) 권한으로 실행 — 셋업과 검증 전용 */
  async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', true)");
    const res = await this.client.query(sql, params);
    return res.rows as T[];
  }

  async createUser(name: string): Promise<TestUser> {
    const id = randomUUID();
    const email = `${name.toLowerCase()}-${id.slice(0, 8)}@test.local`;
    await this.admin(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, email, JSON.stringify({ display_name: name })],
    );
    return { id, email, name };
  }

  /** 같은 커넥션을 쓰므로 순차 생성한다 */
  async createUsers(...names: string[]) {
    const users: TestUser[] = [];
    for (const n of names) users.push(await this.createUser(n));
    return users;
  }

  /** 특정 사용자(또는 anon)로 SQL 실행. 오류가 나도 트랜잭션은 계속 쓸 수 있다. */
  async as<T = Record<string, unknown>>(
    user: TestUser | "anon",
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await this.client.query("savepoint as_user");
    try {
      if (user === "anon") {
        await this.client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ role: "anon" }),
        ]);
        await this.client.query("set local role anon");
      } else {
        await this.client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: user.id, role: "authenticated", email: user.email }),
        ]);
        await this.client.query("set local role authenticated");
      }
      const res = await this.client.query(sql, params);
      await this.client.query("reset role");
      await this.client.query("release savepoint as_user");
      return res.rows as T[];
    } catch (err) {
      await this.client.query("rollback to savepoint as_user");
      await this.client.query("reset role");
      throw err;
    }
  }

  /** 서버 작업용 역할(service_role 등)로 실행 */
  async asRole<T = Record<string, unknown>>(role: "service_role", sql: string, params: unknown[] = []): Promise<T[]> {
    await this.client.query("savepoint as_role");
    try {
      await this.client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role })]);
      await this.client.query(`set local role ${role}`);
      const res = await this.client.query(sql, params);
      await this.client.query("reset role");
      await this.client.query("release savepoint as_role");
      return res.rows as T[];
    } catch (err) {
      await this.client.query("rollback to savepoint as_role");
      await this.client.query("reset role");
      throw err;
    }
  }

  // ---- 자주 쓰는 RPC 래퍼 ----
  async createCouple(user: TestUser, name: string | null = null) {
    const [row] = await this.as<{ id: string }>(user, "select public.create_couple($1) as id", [name]);
    return row.id;
  }

  async createInvite(user: TestUser) {
    const [row] = await this.as<{ token: string; expires_at: Date }>(
      user,
      "select * from public.create_invite()",
    );
    return row;
  }

  async acceptInvite(user: TestUser, token: string) {
    const [row] = await this.as<{ id: string }>(user, "select public.accept_invite($1) as id", [token]);
    return row.id;
  }

  /** 두 사람을 커플로 연결하고 couple_id 반환 */
  async pair(a: TestUser, b: TestUser, name: string | null = null) {
    const coupleId = await this.createCouple(a, name);
    const { token } = await this.createInvite(a);
    await this.acceptInvite(b, token);
    return coupleId;
  }
}

export async function withTx(fn: (db: Db) => Promise<void>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 없습니다. `npm run test:db`로 실행하세요.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin");
    await fn(new Db(client));
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

/** Postgres 예외 메시지(대문자 코드)로 실패를 검증 */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp | string) {
  try {
    await promise;
  } catch (err) {
    const message = (err as Error).message;
    const ok = typeof pattern === "string" ? message.includes(pattern) : pattern.test(message);
    if (!ok) throw new Error(`예상한 오류(${pattern})가 아닌 다른 오류: ${message}`);
    return;
  }
  throw new Error(`오류(${pattern})가 나야 하는데 성공했습니다`);
}

export type MemoryInput = {
  title: string;
  body?: string;
  happenedOn?: string;
  tags?: string[];
  share?: "draft" | "shared";
};

/** user가 자기 활성 커플에 기록을 쓴다 (실제 앱과 같은 INSERT 경로) */
export async function writeMemory(db: Db, user: TestUser, coupleId: string, m: MemoryInput) {
  const [row] = await db.as<{ id: string }>(
    user,
    `insert into memories (couple_id, author_id, title, body, happened_on, tags, share_status)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [coupleId, user.id, m.title, m.body ?? "", m.happenedOn ?? "2026-05-01", m.tags ?? [], m.share ?? "draft"],
  );
  return row.id;
}

export async function titlesSeenBy(db: Db, user: TestUser) {
  const rows = await db.as<{ title: string }>(user, "select title from memories order by title");
  return rows.map((r) => r.title);
}

export type PhotoInput = {
  memoryId?: string | null;
  lat?: number;
  lng?: number;
  takenAt?: string;
  /** 경로를 직접 지정해 규칙 위반을 시험할 때 */
  path?: string;
};

export function photoPaths(coupleId: string, userId: string, id = randomUUID()) {
  return { id, path: `${coupleId}/${userId}/${id}.webp`, thumb: `${coupleId}/${userId}/${id}_thumb.webp` };
}

/** user가 사진 행을 만든다 (실제 앱과 같은 INSERT 경로) */
export async function insertPhoto(db: Db, user: TestUser, coupleId: string, p: PhotoInput = {}) {
  const { path, thumb } = photoPaths(coupleId, user.id);
  const [row] = await db.as<{ id: string; storage_path: string; thumb_path: string }>(
    user,
    `insert into photos (couple_id, uploader_id, memory_id, storage_path, thumb_path, width, height, bytes,
                         taken_at, taken_at_source, lat, lng, location_source)
     values ($1, $2, $3, $4, $5, 1600, 1200, 123456, $6, $7, $8, $9, $10)
     returning id, storage_path, thumb_path`,
    [
      coupleId, user.id, p.memoryId ?? null, p.path ?? path, thumb,
      p.takenAt ?? null, p.takenAt ? "exif" : null,
      p.lat ?? null, p.lng ?? null, p.lat != null ? "exif" : null,
    ],
  );
  return row;
}

/** Storage API가 하는 것과 같이 사용자 권한으로 storage.objects 에 행을 만든다 */
export async function uploadObject(db: Db, user: TestUser, name: string) {
  await db.as(user, "insert into storage.objects (bucket_id, name, owner) values ('couple-photos', $1, $2)", [name, user.id]);
}

export async function visibleObjects(db: Db, user: TestUser) {
  const rows = await db.as<{ name: string }>(user, "select name from storage.objects where bucket_id = 'couple-photos' order by name");
  return rows.map((r) => r.name);
}
