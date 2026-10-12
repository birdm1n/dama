/**
 * 서비스명·로고 텍스트는 여기 한 곳에서만 바꾼다.
 * (DAMA는 임시 이름)
 */
export const site = {
  name: "DAMA",
  /** 헤더에 표시되는 텍스트 로고 */
  logoText: "dama",
  tagline: "둘이 함께 담는 우리의 장소들",
  description: "커플이 함께한 추억을 기록하고, 지도에서 데이트 동선을 돌아보는 공간",
  /** 초대 링크 유효 시간(표시용). 실제 만료는 DB 함수 create_invite가 결정한다. */
  inviteValidHours: 24,
  /** 연결 해제 후 보관 기간(표시용). 실제 값은 DB 함수 leave_couple이 결정한다. */
  dissolveRetentionDays: 30,
} as const;
