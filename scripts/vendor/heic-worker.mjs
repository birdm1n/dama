// HEIC 디코딩 전용 워커 (public/vendor/heic/로 복사되어 서빙된다).
// libheif 바인딩(heic-to)이 내부적으로 new Function(eval)을 쓰기 때문에, eval 허용을 이 워커에만 한정한다.
// 이 경로의 응답 CSP: eval 허용 + 네트워크 차단(connect-src는 data:/blob:만). 워커는 페이지 DOM·쿠키에 접근할 수 없다.
import { heicTo, isHeic } from "./heic-to.js";

self.onmessage = async (event) => {
  const { id, file } = event.data;
  try {
    if (!(await isHeic(file))) throw new Error("not-heic");
    const bitmap = await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
