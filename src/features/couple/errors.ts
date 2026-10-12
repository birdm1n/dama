/** DB 함수가 던지는 오류 코드 → 사용자에게 보여줄 문구 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "로그인이 필요해요.",
  ALREADY_IN_COUPLE: "이미 연결된 커플 공간이 있어요. 새로 연결하려면 먼저 지금 공간의 연결을 해제해야 해요.",
  NOT_IN_COUPLE: "아직 커플 공간이 없어요.",
  COUPLE_FULL: "이 커플 공간은 이미 두 사람이 연결되어 있어요.",
  COUPLE_INACTIVE: "이미 연결이 해제된 커플 공간이에요.",
  RATE_LIMITED: "초대 링크를 너무 자주 만들었어요. 잠시 후 다시 시도해 주세요.",
  INVITE_INVALID: "유효하지 않은 초대 링크예요. 링크를 다시 확인해 주세요.",
  INVITE_EXPIRED: "만료된 초대 링크예요. 상대에게 새 링크를 요청해 주세요.",
  INVITE_USED: "이미 사용된 초대 링크예요.",
  INVITE_REVOKED: "취소된 초대 링크예요. 상대에게 새 링크를 요청해 주세요.",
  INVITE_OWN: "내가 만든 초대 링크는 직접 수락할 수 없어요. 상대에게 링크를 보내 주세요.",
};

export const FALLBACK_ERROR = "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

export type CoupleErrorCode = keyof typeof MESSAGES;

/** Postgres 예외 메시지에서 코드 추출 (예: "INVITE_EXPIRED") */
export function coupleErrorCode(message: string | null | undefined): string | null {
  if (!message) return null;
  for (const [, word] of message.matchAll(/\b([A-Z][A-Z_]{3,})\b/g)) {
    if (word in MESSAGES) return word;
  }
  return null;
}

export function coupleErrorMessage(message: string | null | undefined): string {
  const code = coupleErrorCode(message);
  return code ? MESSAGES[code] : FALLBACK_ERROR;
}
