/**
 * 지도용 데이터 가공 (부수효과 없음).
 *
 * "코스"는 같은 날짜의 기록에 붙은 장소를 **기록 순서**대로 이은 것이다.
 *  - 기록 순서 = 기록을 쓴 순서(created_at) → 기록 안의 장소 순서(seq)
 *  - 실제 이동 경로가 아니다. 화면에 항상 그렇게 표시한다.
 */
export type MapPlace = {
  id: string;
  memoryId: string;
  memoryTitle: string;
  memoryCreatedAt: string;
  happenedOn: string; // YYYY-MM-DD
  shareStatus: "draft" | "shared";
  isMine: boolean;
  seq: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  locationSource: "exif" | "device" | "manual";
  accuracyM: number | null;
};

export function orderInCourse(a: MapPlace, b: MapPlace) {
  return (
    a.memoryCreatedAt.localeCompare(b.memoryCreatedAt) ||
    a.memoryId.localeCompare(b.memoryId) ||
    a.seq - b.seq ||
    a.id.localeCompare(b.id)
  );
}

export type Course = { date: string; places: MapPlace[]; memoryCount: number };

/** 날짜별 코스. 최근 날짜가 먼저. */
export function buildCourses(places: MapPlace[]): Course[] {
  const byDate = new Map<string, MapPlace[]>();
  for (const p of places) byDate.set(p.happenedOn, [...(byDate.get(p.happenedOn) ?? []), p]);
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const sorted = [...list].sort(orderInCourse);
      return { date, places: sorted, memoryCount: new Set(sorted.map((p) => p.memoryId)).size };
    });
}

/** 기록 순서 연결선. 같은 지점이 연속되면 한 번만. 2곳 미만이면 선 없음. */
export function courseLine(places: MapPlace[]): [number, number][] | null {
  const coords: [number, number][] = [];
  for (const p of places) {
    const last = coords[coords.length - 1];
    if (!last || last[0] !== p.lng || last[1] !== p.lat) coords.push([p.lng, p.lat]);
  }
  return coords.length >= 2 ? coords : null;
}

export function boundsOf(points: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [[w, s], [e, n]];
}

export function sourceLabel(p: Pick<MapPlace, "locationSource" | "accuracyM">) {
  const src = p.locationSource === "exif" ? "사진 정보" : p.locationSource === "device" ? "기기 위치" : "직접 지정";
  if (p.locationSource === "manual") return src;
  return `${src} · ${p.accuracyM != null ? `±${p.accuracyM}m` : "정확도 정보 없음"}`;
}
