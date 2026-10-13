/**
 * WebP 파일에서 메타데이터 청크(EXIF, XMP)를 제거한다. 공개 게시물 이미지를 서버에서 한 번 더 정리하는 용도.
 * (사진은 이미 브라우저에서 재인코딩되어 EXIF가 없지만, 공개 전 이중 확인)
 *
 * WebP = "RIFF" <size> "WEBP" { <fourcc> <size> <data>[pad] }*
 * 확장 포맷(VP8X)의 플래그에서 EXIF(0x08)·XMP(0x04) 비트도 끈다. 색 프로필(ICCP)은 위치 정보가 아니므로 유지.
 */
const DROP = new Set(["EXIF", "XMP "]);

export class NotWebpError extends Error {}

export function stripWebpMetadata(input: Uint8Array): Uint8Array {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const ascii = (o: number) => String.fromCharCode(input[o], input[o + 1], input[o + 2], input[o + 3]);
  if (input.length < 12 || ascii(0) !== "RIFF" || ascii(8) !== "WEBP") throw new NotWebpError("not webp");

  const riffEnd = Math.min(8 + view.getUint32(4, true), input.length);
  const kept: Uint8Array[] = [];
  let off = 12;
  while (off + 8 <= riffEnd) {
    const fourcc = ascii(off);
    const size = view.getUint32(off + 4, true);
    const total = 8 + size + (size & 1);
    if (off + 8 + size > riffEnd) throw new NotWebpError("truncated chunk");
    if (!DROP.has(fourcc)) {
      const chunk = input.slice(off, off + Math.min(total, riffEnd - off));
      if (fourcc === "VP8X" && size >= 1) chunk[8] &= ~(0x08 | 0x04);
      kept.push(chunk);
    }
    off += total;
  }

  const bodyLen = kept.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + bodyLen);
  out.set(input.subarray(0, 12), 0);
  new DataView(out.buffer).setUint32(4, 4 + bodyLen, true);
  let p = 12;
  for (const c of kept) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** 검증용: 파일에 메타데이터 청크가 남아 있는가 */
export function hasWebpMetadata(input: Uint8Array): boolean {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const ascii = (o: number) => String.fromCharCode(input[o], input[o + 1], input[o + 2], input[o + 3]);
  let off = 12;
  while (off + 8 <= input.length) {
    if (DROP.has(ascii(off))) return true;
    const size = view.getUint32(off + 4, true);
    off += 8 + size + (size & 1);
  }
  return false;
}
