import { z } from "zod";

// zod v4는 기본으로 Function("")을 시도해 JIT 사용 가능 여부를 본다.
// CSP(eval 금지) 아래에서는 매번 위반 보고만 남기므로 처음부터 JIT 없이 동작시킨다.
z.config({ jitless: true });

export { z };
