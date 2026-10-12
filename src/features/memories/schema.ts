import { z } from "zod";

export const TAG_MAX_COUNT = 10;
export const TAG_MAX_LENGTH = 20;

/**
 * "카페, 한강 #산책" → ["카페", "한강", "산책"]
 * 쉼표·# 로 구분하고, 대소문자 무시 중복 제거. 규칙은 DB의 private.valid_tags와 같다.
 */
export function parseTags(input: string): { tags: string[]; error?: string } {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(/[,#\n]/)) {
    // 제어 문자 제거, 연속 공백 정리
    const t = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length > TAG_MAX_LENGTH) return { tags: [], error: `태그는 ${TAG_MAX_LENGTH}자 이하로 입력해 주세요.` };
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(t);
  }
  if (tags.length > TAG_MAX_COUNT) return { tags: [], error: `태그는 ${TAG_MAX_COUNT}개까지 달 수 있어요.` };
  return { tags };
}

export const memorySchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(80, "제목은 80자 이하로 입력해 주세요."),
  body: z.string().max(5000, "내용은 5000자 이하로 입력해 주세요."),
  happenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "날짜를 확인해 주세요."),
  tags: z.string().max(400),
  shareStatus: z.enum(["draft", "shared"], { message: "공개 범위를 선택해 주세요." }),
});

export const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  tag: z.string().trim().max(TAG_MAX_LENGTH).optional().catch(undefined),
  scope: z.enum(["all", "shared", "draft"]).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type MemoryFilter = z.infer<typeof filterSchema>;

/** 검색 파라미터 객체(문자열|배열|undefined)를 필터로 */
export function parseFilter(sp: Record<string, string | string[] | undefined>): MemoryFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return filterSchema.parse({
    q: one(sp.q),
    tag: one(sp.tag),
    scope: one(sp.scope),
    from: one(sp.from),
    to: one(sp.to),
    page: one(sp.page),
  });
}

/** 오늘 날짜(Asia/Seoul) YYYY-MM-DD */
export function todayInSeoul(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
