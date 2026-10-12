import { distanceM } from "./meta";

/**
 * 비슷한 시간·장소에서 찍힌 사진을 "기록 후보"로 묶는다.
 * 후보일 뿐이다: 같은 묶음이라고 두 사람이 함께 있었다고 단정하지 않으며, 사용자가 확정한다.
 *
 * 규칙(시간순으로 보며 앞 사진과 비교)
 *  - 촬영 시각 간격이 maxGapMinutes 이하이고
 *  - 두 사진 모두 위치가 있으면 거리가 maxDistanceM 이하
 *  - 시각이 없는 사진은 따로 "시각 정보 없음" 묶음
 */
export type GroupablePhoto = { key: string; takenAt: string | null; lat: number | null; lng: number | null };

export type PhotoGroup<T extends GroupablePhoto> = {
  id: string;
  items: T[];
  start: string | null;
  end: string | null;
  hasTime: boolean;
};

export function groupPhotos<T extends GroupablePhoto>(
  photos: T[],
  { maxGapMinutes = 180, maxDistanceM = 2000 }: { maxGapMinutes?: number; maxDistanceM?: number } = {},
): PhotoGroup<T>[] {
  const timed = photos.filter((p) => p.takenAt).sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));
  const untimed = photos.filter((p) => !p.takenAt);
  const groups: T[][] = [];

  for (const p of timed) {
    const current = groups[groups.length - 1];
    const prev = current?.[current.length - 1];
    if (prev) {
      const gap = (Date.parse(p.takenAt!) - Date.parse(prev.takenAt!)) / 60_000;
      // 위치가 있는 가장 최근 사진과 비교
      const lastWithLoc = [...current].reverse().find((x) => x.lat != null && x.lng != null);
      const far =
        lastWithLoc && p.lat != null && p.lng != null
          ? distanceM({ lat: lastWithLoc.lat!, lng: lastWithLoc.lng! }, { lat: p.lat, lng: p.lng }) > maxDistanceM
          : false;
      if (gap <= maxGapMinutes && !far) {
        current.push(p);
        continue;
      }
    }
    groups.push([p]);
  }

  const result: PhotoGroup<T>[] = groups.map((items) => ({
    id: `g-${items[0].key}`,
    items,
    start: items[0].takenAt,
    end: items[items.length - 1].takenAt,
    hasTime: true,
  }));
  if (untimed.length) result.push({ id: "g-untimed", items: untimed, start: null, end: null, hasTime: false });
  return result;
}
