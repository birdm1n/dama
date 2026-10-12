/**
 * EXIF 원시값 → 저장할 메타데이터. (브라우저·서버·테스트 공용, 부수효과 없음)
 *
 * 촬영 시각: EXIF DateTimeOriginal에는 시간대가 없다. OffsetTimeOriginal이 있으면 그 오프셋을 쓰고,
 * 없으면 "이 기기의 현재 시간대에서 찍었다"고 가정한다. 확정이 아니므로 사용자가 확인·수정한다.
 */

export type RawExif = {
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
  OffsetTimeOriginal?: unknown;
  OffsetTime?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  GPSHPositioningError?: unknown;
};

export type PhotoMeta = {
  takenAt: string | null; // ISO 8601 (UTC)
  takenAtAssumedTimezone: boolean; // 오프셋 없이 기기 시간대로 가정했는가
  lat: number | null;
  lng: number | null;
  accuracyM: number | null; // EXIF에 없으면 null (= 알 수 없음)
};

const EXIF_DT = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const OFFSET = /^([+-])(\d{2}):?(\d{2})$/;

/** "2026:05:17 14:30:00" + "+09:00" → Date. 오프셋이 없으면 tzOffsetMinutes(기기 기준)를 쓴다. */
export function parseExifDateTime(
  raw: unknown,
  offset: unknown,
  fallbackOffsetMinutes: (localGuess: Date) => number,
): { date: Date; assumed: boolean } | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(EXIF_DT);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);

  const om = typeof offset === "string" ? offset.trim().match(OFFSET) : null;
  if (om) {
    const mins = (om[1] === "-" ? -1 : 1) * (Number(om[2]) * 60 + Number(om[3]));
    return { date: new Date(asUtc - mins * 60_000), assumed: false };
  }
  const guess = new Date(asUtc);
  return { date: new Date(asUtc - fallbackOffsetMinutes(guess) * 60_000), assumed: true };
}

export function normalizeLocation(lat: unknown, lng: unknown, acc: unknown) {
  const la = typeof lat === "number" ? lat : NaN;
  const lo = typeof lng === "number" ? lng : NaN;
  // 0,0은 GPS 미수신 기기가 흔히 기록하는 값이라 위치 없음으로 본다
  const valid = Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0);
  if (!valid) return { lat: null, lng: null, accuracyM: null };
  const a = typeof acc === "number" && Number.isFinite(acc) && acc >= 0 && acc < 100_000 ? Math.round(acc * 10) / 10 : null;
  return { lat: Math.round(la * 1e6) / 1e6, lng: Math.round(lo * 1e6) / 1e6, accuracyM: a };
}

export function metaFromExif(raw: RawExif | null | undefined, now: Date = new Date()): PhotoMeta {
  const r = raw ?? {};
  const deviceOffset = (d: Date) => -d.getTimezoneOffset();
  const dt =
    parseExifDateTime(r.DateTimeOriginal, r.OffsetTimeOriginal ?? r.OffsetTime, deviceOffset) ??
    parseExifDateTime(r.CreateDate, r.OffsetTime, deviceOffset);
  // 미래 시각(카메라 시계 오류)은 신뢰하지 않는다
  const takenAt = dt && dt.date.getTime() <= now.getTime() + 24 * 3600_000 ? dt.date.toISOString() : null;
  return {
    takenAt,
    takenAtAssumedTimezone: Boolean(takenAt && dt?.assumed),
    ...normalizeLocation(r.latitude, r.longitude, r.GPSHPositioningError),
  };
}

/** 두 좌표 사이 거리(m) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
