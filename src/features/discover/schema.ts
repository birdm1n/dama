import { z } from "@/lib/zod";

export const publishSchema = z.object({
  memoryId: z.string().uuid(),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(80, "제목은 80자 이하로 입력해 주세요."),
  body: z.string().max(3000, "내용은 3000자 이하로 입력해 주세요."),
  area: z.string().trim().max(40, "지역은 40자 이하로 입력해 주세요."),
  tags: z.string().max(400),
  photoIds: z.array(z.string().uuid()).max(10, "사진은 10장까지 공개할 수 있어요."),
  placeIds: z.array(z.string().uuid()).max(20),
  confirmed: z.literal(true, { message: "공개되는 내용을 확인해 주세요." }),
});
export type PublishInput = z.infer<typeof publishSchema>;

export const REPORT_REASONS = {
  spam: "광고·스팸",
  inappropriate: "불쾌하거나 부적절한 내용",
  privacy: "내 개인정보·사진이 노출됨",
  other: "기타",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
