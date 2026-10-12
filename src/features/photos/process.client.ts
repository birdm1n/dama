"use client";

import { metaFromExif, type PhotoMeta } from "./meta";

export const MAX_EDGE = 2048;
export const THUMB_EDGE = 480;
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export type ProcessedPhoto = {
  meta: PhotoMeta;
  main: Blob;
  thumb: Blob;
  width: number;
  height: number;
};

export class UnsupportedImageError extends Error {}

/** 원본에서 EXIF(시각·위치)만 읽는다. 원본 파일은 서버로 보내지 않는다. */
async function readMeta(file: File): Promise<PhotoMeta> {
  try {
    // 브라우저에서만 필요하므로 지연 로드(서버 렌더링 번들에 넣지 않는다)
    const { default: exifr } = await import("exifr");
    const raw = await exifr.parse(file, {
      tiff: true, exif: true, gps: true, ifd1: false, interop: false, xmp: false, icc: false, iptc: false,
      reviveValues: false,
    });
    return metaFromExif(raw);
  } catch {
    return metaFromExif(null);
  }
}

/**
 * 다시 인코딩(WebP)한다. 캔버스로 다시 그리기 때문에 EXIF(위치 포함) 등 메타데이터가 결과 파일에 남지 않는다.
 * 방향(Orientation)은 createImageBitmap이 EXIF대로 적용한다.
 */
async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnsupportedImageError("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  if (blob.type !== "image/webp") throw new UnsupportedImageError("webp");
  return { blob, w, h };
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (file.size > MAX_INPUT_BYTES) throw new UnsupportedImageError("too-large");
  const meta = await readMeta(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // 예: 이 브라우저가 HEIC를 해석하지 못하는 경우
    throw new UnsupportedImageError("decode");
  }
  try {
    const main = await encode(bitmap, MAX_EDGE, 0.86);
    const thumb = await encode(bitmap, THUMB_EDGE, 0.8);
    return { meta, main: main.blob, thumb: thumb.blob, width: main.w, height: main.h };
  } finally {
    bitmap.close();
  }
}
