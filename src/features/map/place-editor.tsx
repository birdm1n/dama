"use client";

import { useActionState, useState } from "react";
import { Camera, Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { addMemoryPlace } from "./actions";
import { MapView, type Pin } from "./map-view";

type Picked = { lat: number; lng: number; source: "exif" | "device" | "manual"; accuracy: number | null; note: string };
type PhotoLoc = { id: string; lat: number; lng: number; accuracyM: number | null; label: string };

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function PlaceEditor({ memoryId, existing, photoLocations }: { memoryId: string; existing: Pin[]; photoLocations: PhotoLoc[] }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [coordText, setCoordText] = useState("");
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addMemoryPlace(prev, fd);
    if (result.message) {
      // 저장 성공 → 폼 초기화
      setPicked(null);
      setCoordText("");
      setFormKey((k) => k + 1);
    }
    return result;
  }, {});

  function useDevice() {
    setGeoError(null);
    if (!("geolocation" in navigator)) return setGeoError("이 브라우저는 위치 기능을 지원하지 않아요.");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPicked({
          lat: round(pos.coords.latitude),
          lng: round(pos.coords.longitude),
          source: "device",
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
          note: "지금 이 기기의 위치",
        }),
      (err) => setGeoError(err.code === err.PERMISSION_DENIED ? "위치 권한이 거부됐어요." : "현재 위치를 가져오지 못했어요."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function applyCoords() {
    const m = coordText.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    const lat = m ? Number(m[1]) : NaN;
    const lng = m ? Number(m[2]) : NaN;
    if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) return setGeoError("‘위도, 경도’ 형식으로 입력해 주세요. 예) 37.5446, 127.0374");
    setGeoError(null);
    setPicked({ lat: round(lat), lng: round(lng), source: "manual", accuracy: null, note: "직접 입력한 좌표" });
  }

  const fe = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <MapView
        pins={existing}
        picked={picked}
        onPick={(p) => setPicked({ lat: round(p.lat), lng: round(p.lng), source: "manual", accuracy: null, note: "지도에서 직접 고른 위치" })}
        className="h-80"
        ariaLabel="장소 고르기 지도"
      />
      <p className="text-xs text-ink-muted">지도를 눌러 위치를 고르거나, 아래 방법 중 하나를 쓰세요. 주소 검색은 아직 지원하지 않아요.</p>

      <div className="flex flex-wrap gap-2">
        {photoLocations.map((p) => (
          <Button key={p.id} type="button" size="sm" variant="outline"
            onClick={() => setPicked({ lat: p.lat, lng: p.lng, source: "exif", accuracy: p.accuracyM, note: `사진 위치 (${p.label})` })}>
            <Camera /> 사진 위치: {p.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={useDevice}>
          <Crosshair /> 현재 위치
        </Button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-muted">좌표 직접 입력</summary>
        <div className="mt-2 flex gap-2">
          <Input value={coordText} onChange={(e) => setCoordText(e.target.value)} placeholder="37.5446, 127.0374" aria-label="좌표" className="max-w-64" />
          <Button type="button" size="sm" variant="outline" onClick={applyCoords}>적용</Button>
        </div>
      </details>
      {geoError && <FormMessage error={geoError} />}

      <form key={formKey} action={action} className="card-paper space-y-4 p-5" noValidate>
        <input type="hidden" name="memoryId" value={memoryId} />
        <input type="hidden" name="lat" value={picked?.lat ?? ""} />
        <input type="hidden" name="lng" value={picked?.lng ?? ""} />
        <input type="hidden" name="source" value={picked?.source ?? ""} />
        <input type="hidden" name="accuracy" value={picked?.accuracy ?? ""} />
        <p className="flex items-center gap-1.5 text-sm" data-testid="picked">
          <MapPin className="size-4 text-rose-deep" />
          {picked ? (
            <span>
              {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)} · {picked.note}
              {picked.source !== "manual" && ` · ${picked.accuracy != null ? `정확도 ±${picked.accuracy}m` : "정확도 정보 없음"}`}
            </span>
          ) : (
            <span className="text-ink-muted">아직 위치를 고르지 않았어요</span>
          )}
        </p>
        <FieldError errors={fe.location} />
        <div>
          <Label htmlFor="place-name">장소 이름</Label>
          <Input id="place-name" name="name" maxLength={60} placeholder="예) 서울숲 은행나무길" aria-invalid={Boolean(fe.name)} />
          <FieldError errors={fe.name} />
        </div>
        <div>
          <Label htmlFor="place-address">주소·메모 <span className="font-normal text-ink-muted">(선택)</span></Label>
          <Input id="place-address" name="address" maxLength={200} />
        </div>
        <FormMessage error={state.error} message={state.message} />
        <SubmitButton disabled={!picked} pendingText="추가 중…">장소 추가</SubmitButton>
      </form>
    </div>
  );
}
