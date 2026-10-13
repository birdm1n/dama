"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { loadInvite } from "./actions";
import { AcceptInviteForm } from "./components";
import { clearStashedInvite, readStashedInvite, stashInviteFromHash } from "./invite-token";

const INVALID_TEXT: Record<string, { title: string; body: string }> = {
  invalid: { title: "유효하지 않은 링크예요", body: "링크가 잘렸거나 잘못 복사됐을 수 있어요. 상대에게 다시 받아 주세요." },
  expired: { title: "만료된 링크예요", body: "초대 링크는 24시간 동안만 유효해요. 상대에게 새 링크를 요청해 주세요." },
  used: { title: "이미 사용된 링크예요", body: "초대 링크는 한 번만 쓸 수 있어요." },
  revoked: { title: "취소된 링크예요", body: "상대가 새 링크를 만들었거나 초대를 취소했어요. 새 링크를 요청해 주세요." },
};

type Loaded = { token: string } & Awaited<ReturnType<typeof loadInvite>>;

/** 토큰은 주소의 #fragment(또는 로그인 전에 보관해 둔 값)에서 읽는다. 서버 요청 URL에는 실리지 않는다. */
export function InviteGate() {
  const [state, setState] = useState<Loaded | "missing" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = stashInviteFromHash() ?? readStashedInvite();
      const r = token ? await loadInvite(token) : null;
      if (cancelled) return;
      if (!token || !r) return setState("missing");
      // 더 쓸 수 없는 초대는 보관할 이유가 없다
      if (r.preview.status !== "valid") clearStashedInvite();
      setState({ token, ...r });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null) {
    return <p className="text-sm text-ink-muted">초대 정보를 확인하는 중…</p>;
  }

  if (state === "missing") {
    return (
      <>
        <h1 className="font-display text-2xl">초대 링크를 찾지 못했어요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          받은 초대 링크를 처음부터 다시 열어 주세요. 링크 전체(# 뒤까지)가 있어야 해요.
        </p>
        <Link href="/home" className={buttonVariants({ variant: "outline", className: "mt-6" })}>홈으로</Link>
      </>
    );
  }

  const { preview, hasCouple, token } = state;

  if (preview.status === "own") {
    return (
      <>
        <h1 className="font-display text-2xl">내가 만든 초대 링크예요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">이 링크를 상대에게 보내 주세요. 상대가 열어서 수락하면 연결돼요.</p>
        <Link href="/couple" className={buttonVariants({ variant: "outline", className: "mt-6" })}>커플 공간으로</Link>
      </>
    );
  }

  if (preview.status !== "valid") {
    const t = INVALID_TEXT[preview.status] ?? INVALID_TEXT.invalid;
    return (
      <>
        <h1 className="font-display text-2xl">{t.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.body}</p>
        <Link href="/home" className={buttonVariants({ variant: "outline", className: "mt-6" })}>홈으로</Link>
      </>
    );
  }

  if (hasCouple) {
    return (
      <>
        <h1 className="font-display text-2xl">이미 커플 공간이 있어요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          <b className="text-ink">{preview.inviterName}</b>님의 초대를 수락하려면 먼저 지금 공간의 연결을 해제해야 해요.
          한 사람은 하나의 커플 공간에만 속할 수 있어요.
        </p>
        <Link href="/couple" className={buttonVariants({ variant: "outline", className: "mt-6" })}>내 커플 공간 보기</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl">
        <b className="font-semibold">{preview.inviterName}</b>님이
        <br />
        {preview.coupleName ? `‘${preview.coupleName}’에 ` : ""}초대했어요
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        수락하면 두 사람이 하나의 커플 공간을 함께 써요. 각자 올린 사진과 기록은 직접 공유하기 전까지 상대에게 자동으로
        보이지 않아요.
      </p>
      {preview.expiresAt && <p className="mt-2 text-xs text-ink-muted">{formatDateTime(preview.expiresAt)}까지 유효</p>}
      <div className="mt-6">
        <AcceptInviteForm token={token} onSubmit={clearStashedInvite} />
      </div>
    </>
  );
}

/** 로그인·가입 화면: 초대 링크로 들어왔다면 fragment의 토큰을 보관해 둔다(인증 후 /invite에서 사용). */
export function InviteTokenStash() {
  useEffect(() => {
    stashInviteFromHash();
  }, []);
  return null;
}
