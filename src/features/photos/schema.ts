import { z } from "zod";

const iso = z.string().datetime({ offset: true });

export const photoInputSchema = z
  .object({
    id: z.string().uuid(),
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
    bytes: z.number().int().min(1).max(20_000_000),
    takenAt: iso.nullable(),
    takenAtSource: z.enum(["exif", "manual"]).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    locationSource: z.enum(["exif", "device", "manual"]).nullable(),
    accuracyM: z.number().min(0).max(100_000).nullable(),
    groupId: z.string().max(80),
  })
  .refine((p) => (p.takenAt === null) === (p.takenAtSource === null), "taken_at_source")
  .refine((p) => (p.lat === null) === (p.lng === null) && (p.lat === null) === (p.locationSource === null), "location")
  .refine((p) => p.lat !== null || p.accuracyM === null, "accuracy");

export const groupDecisionSchema = z.discriminatedUnion("mode", [
  z.object({ groupId: z.string().max(80), mode: z.literal("library") }),
  z.object({
    groupId: z.string().max(80),
    mode: z.literal("memory"),
    title: z.string().trim().min(1, "기록 제목을 입력해 주세요.").max(80),
    happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export const savePhotosSchema = z.object({
  photos: z.array(photoInputSchema).min(1).max(30),
  /** 특정 기록에 바로 붙일 때 */
  memoryId: z.string().uuid().nullable(),
  groups: z.array(groupDecisionSchema).max(30),
});
export type SavePhotosInput = z.infer<typeof savePhotosSchema>;

export function photoStoragePaths(coupleId: string, userId: string, photoId: string) {
  return {
    storage_path: `${coupleId}/${userId}/${photoId}.webp`,
    thumb_path: `${coupleId}/${userId}/${photoId}_thumb.webp`,
  };
}
