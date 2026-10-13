/**
 * 초대 토큰은 URL 경로가 아니라 #fragment(`/invite#토큰`)로 전달한다.
 * fragment는 서버로 전송되지 않아 요청 로그·Referer에 남지 않는다.
 *
 * 로그인·가입·이메일 인증을 거치는 동안 fragment가 사라지므로, 같은 브라우저의
 * localStorage에 만료 시각과 함께 잠시 보관한다(초대 자체가 24시간·1회용).
 */
const KEY = "dama.pendingInvite";
const TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

export function invitePath(token: string) {
  return `/invite#${token}`;
}

export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** 현재 주소의 fragment에 토큰이 있으면 보관하고 주소창에서 지운다. */
export function stashInviteFromHash(): string | null {
  const token = window.location.hash.slice(1);
  if (!isInviteToken(token)) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + TTL_MS }));
  } catch {
    /* 저장소를 쓸 수 없어도 이번 화면에서는 진행할 수 있다 */
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

export function readStashedInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token?: unknown; exp?: unknown };
    if (isInviteToken(token) && typeof exp === "number" && exp > Date.now()) return token;
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
  return null;
}

export function clearStashedInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
