/** 기념일(YYYY-MM-DD)부터 오늘까지 함께한 날 수. 기념일 당일 = 1일째. */
export function daysTogether(anniversaryOn: string, today: Date = new Date()): number {
  const [y, m, d] = anniversaryOn.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((now - start) / 86_400_000) + 1;
}

const fmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export function formatDateTime(iso: string) {
  return fmt.format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}
