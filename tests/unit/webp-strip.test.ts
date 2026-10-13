import { describe, it, expect } from "vitest";
import { hasWebpMetadata, NotWebpError, stripWebpMetadata } from "@/features/discover/webp-strip";

const enc = new TextEncoder();
function chunk(fourcc: string, data: Uint8Array) {
  const pad = data.length & 1;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(enc.encode(fourcc), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}
function webp(...chunks: Uint8Array[]) {
  const body = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + body);
  out.set(enc.encode("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, 4 + body, true);
  out.set(enc.encode("WEBP"), 8);
  let p = 12;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
const vp8x = (flags: number) => chunk("VP8X", new Uint8Array([flags, 0, 0, 0, 9, 0, 0, 9, 0, 0]));
const image = chunk("VP8 ", new Uint8Array([1, 2, 3, 4, 5])); // 홀수 길이 → 패딩 확인
const exif = chunk("EXIF", enc.encode("Exif\0\0GPSLatitude 37.5446"));
const xmp = chunk("XMP ", enc.encode("<x:xmpmeta>gps</x:xmpmeta>"));
const icc = chunk("ICCP", new Uint8Array([7, 7, 7, 7]));

describe("stripWebpMetadata", () => {
  it("EXIF·XMP 청크를 지우고 VP8X 플래그와 RIFF 크기를 고친다, 색 프로필·이미지는 유지", () => {
    const src = webp(vp8x(0x08 | 0x04 | 0x20), icc, image, exif, xmp);
    expect(hasWebpMetadata(src)).toBe(true);
    const out = stripWebpMetadata(src);
    expect(hasWebpMetadata(out)).toBe(false);
    expect(new TextDecoder().decode(out)).not.toContain("GPS");
    expect(out).toEqual(webp(vp8x(0x20), icc, image));
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
  });

  it("메타데이터가 없으면 그대로", () => {
    const src = webp(image);
    expect(stripWebpMetadata(src)).toEqual(src);
  });

  it("WebP가 아니거나 잘린 파일은 거부", () => {
    expect(() => stripWebpMetadata(enc.encode("\xff\xd8\xff\xe0 jpeg"))).toThrow(NotWebpError);
    const bad = webp(image);
    new DataView(bad.buffer).setUint32(16, 9999, true);
    expect(() => stripWebpMetadata(bad)).toThrow(NotWebpError);
  });
});
