"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from "maplibre-gl";
import { boundsOf } from "./course";

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  /** 코스 번호 등 */
  label?: string;
  title: string;
  subtitle?: string;
  href?: string;
  draft?: boolean;
};

/** 키 없이 쓸 수 있는 OpenFreeMap. 환경변수로 바꿀 수 있다. */
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

/** 배경 지도를 못 불러올 때 쓰는 단색 스타일(장소 표시는 그대로 동작) */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#EDE2D5" } }],
};

const SEOUL: [number, number] = [126.978, 37.5665];

function el(tag: string, className: string, text?: string) {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

export function MapView({
  pins,
  line,
  onPick,
  picked,
  className = "h-[60vh] min-h-80",
  ariaLabel = "지도",
}: {
  pins: Pin[];
  /** 기록 순서 연결선 [lng, lat][] */
  line?: [number, number][] | null;
  /** 지정하면 지도를 눌러 위치를 고를 수 있다 */
  onPick?: (p: { lat: number; lng: number }) => void;
  picked?: { lat: number; lng: number } | null;
  className?: string;
  ariaLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<MlMarker[]>([]);
  const pickMarker = useRef<MlMarker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      ml.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
      try {
        map = new ml.Map({
          container: box.current,
          style: STYLE_URL,
          center: SEOUL,
          zoom: 11,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
      } catch {
        setUnsupported(true); // WebGL 미지원 등
        return;
      }
      mapRef.current = map;
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

      let fellBack = false;
      map.on("error", (e) => {
        // 스타일(배경 지도) 로드 실패 → 단색 배경으로 전환
        if (!fellBack && !map!.isStyleLoaded()) {
          fellBack = true;
          setNotice("배경 지도를 불러오지 못했어요. 장소 표시는 정상이에요.");
          map!.setStyle(FALLBACK_STYLE);
        }
        void e;
      });
      map.on("load", () => !cancelled && setReady(true));
      map.on("style.load", () => !cancelled && setReady(true));
      map.on("click", (e) => onPickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // 핀 + 연결선
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let alive = true;
    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive) return;
      markers.current.forEach((m) => m.remove());
      markers.current = pins.map((p) => {
        const dot = el("div", `dama-pin${p.draft ? " dama-pin--draft" : ""}${p.label ? " dama-pin--num" : ""}`, p.label);
        dot.dataset.testid = "map-pin";
        dot.setAttribute("aria-label", p.title);
        const pop = el("div", "dama-pop");
        const t = p.href ? (el("a", "dama-pop__title", p.title) as HTMLAnchorElement) : el("p", "dama-pop__title", p.title);
        if (p.href) (t as HTMLAnchorElement).href = p.href;
        pop.append(t);
        if (p.subtitle) pop.append(el("p", "dama-pop__sub", p.subtitle));
        return new ml.Marker({ element: dot })
          .setLngLat([p.lng, p.lat])
          .setPopup(new ml.Popup({ offset: 14, closeButton: false }).setDOMContent(pop))
          .addTo(map);
      });

      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: line ?? [] },
      };
      const src = map.getSource("course") as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) src.setData(data);
      else {
        map.addSource("course", { type: "geojson", data });
        map.addLayer({
          id: "course-line",
          type: "line",
          source: "course",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#B9817B", "line-width": 2.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.9 },
        });
      }
      box.current?.setAttribute("data-line-points", String(line?.length ?? 0));

      const b = boundsOf(pins);
      if (b) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
    })();
    return () => {
      alive = false;
    };
  }, [pins, line, ready]);

  // 고른 위치 표시
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (async () => {
      const ml = await import("maplibre-gl");
      pickMarker.current?.remove();
      pickMarker.current = picked
        ? new ml.Marker({ element: el("div", "dama-pin dama-pin--picked") }).setLngLat([picked.lng, picked.lat]).addTo(map)
        : null;
    })();
  }, [picked, ready]);

  if (unsupported) {
    return (
      <div className={`grid place-items-center rounded-lg border border-border bg-beige/50 p-6 text-center text-sm text-ink-muted ${className}`}>
        이 브라우저에서는 지도를 표시할 수 없어요(WebGL 미지원). 아래 목록에서 장소를 볼 수 있어요.
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={box}
        className={`overflow-hidden rounded-lg border border-border ${className}`}
        role="region"
        aria-label={ariaLabel}
        data-ready={ready ? "true" : "false"}
      />
      {line && line.length >= 2 && (
        <p className="pointer-events-none absolute left-2 top-2 flex items-center gap-2 rounded-full bg-surface/95 px-3 py-1 text-xs text-ink" data-testid="line-legend">
          <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-rose-deep" />
          기록 순서 (실제 이동 경로 아님)
        </p>
      )}
      {notice && (
        <p className="absolute bottom-2 left-2 rounded-full bg-surface/95 px-3 py-1 text-xs text-ink-muted" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
