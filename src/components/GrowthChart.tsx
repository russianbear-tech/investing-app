"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { formatMoney, formatPercent, toneClass } from "@/lib/format";
import { compactMoney, niceTicks, shortDate } from "@/lib/chart";

interface HistoryPoint {
  date: string;
  value: number;
  invested: number;
}

interface HistorySeries {
  points: HistoryPoint[];
  masterCurrency: string;
  incomplete: string[];
}

const RANGES = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
] as const;

// Validated against this app's #09090b surface: adjacent CVD ΔE 26.8,
// normal-vision ΔE 31.8 — both well clear of the 8 / 15 floors.
const C_VALUE = "#3987e5";
const C_INVESTED = "#d95926";
const C_GRID = "#27272a";
const C_AXIS_TEXT = "#71717a";

const PAD = { top: 16, right: 14, bottom: 26, left: 52 };

// useLayoutEffect warns during SSR; this picks the right one per environment so
// the first paint is already at the measured width.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function GrowthChart() {
  const [range, setRange] = useState<string>("6m");
  const [data, setData] = useState<HistorySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(720);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const height = 230;

  // The wrapper is block-level, so it reports the width available to the chart
  // regardless of how wide the SVG inside it currently is. Measure directly and
  // listen on window resize; ResizeObserver is a bonus where it's supported, not
  // the mechanism — relying on it alone leaves the chart stuck at its initial
  // guess and overflowing on narrow screens.
  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.max(260, Math.round(w)));
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/history?range=${range}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load history.");
        setData(json);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const points = data?.points ?? [];
  const currency = data?.masterCurrency ?? "USD";

  const geom = useMemo(() => {
    if (points.length < 2) return null;

    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;

    const values = points.flatMap((p) => [p.value, p.invested]);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Headroom so the lines never touch the frame.
    const span = rawMax - rawMin || rawMax || 1;
    const yMin = Math.max(0, rawMin - span * 0.12);
    const yMax = rawMax + span * 0.12;

    const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
    const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    const line = (get: (p: HistoryPoint) => number) =>
      points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join("");

    const valuePath = line((p) => p.value);
    const investedPath = line((p) => p.invested);
    const areaPath =
      `${valuePath}L${x(points.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
      `L${PAD.left.toFixed(1)},${(PAD.top + plotH).toFixed(1)}Z`;

    return {
      x,
      y,
      plotW,
      plotH,
      yMin,
      yMax,
      valuePath,
      investedPath,
      areaPath,
      ticks: niceTicks(yMin, yMax, 4),
    };
  }, [points, width]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!geom || points.length < 2 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const rel = clientX - rect.left - PAD.left;
      const ratio = Math.max(0, Math.min(1, rel / geom.plotW));
      setHoverIdx(Math.round(ratio * (points.length - 1)));
    },
    [geom, points.length]
  );

  const active = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];
  const first = points[0];
  const gain = active ? active.value - active.invested : 0;
  const gainPct = active && active.invested > 0 ? (gain / active.invested) * 100 : 0;
  const spanDays = points.length;

  const xLabelIdx = useMemo(() => {
    if (points.length < 2) return [];
    const n = Math.min(5, points.length);
    return Array.from({ length: n }, (_, k) =>
      Math.round((k / (n - 1)) * (points.length - 1))
    );
  }, [points.length]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-zinc-200">Growth over time</h2>
          {active && (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <span className="tnum text-zinc-300">
                Worth{" "}
                <span className="font-medium text-zinc-100">
                  {formatMoney(active.value, currency)}
                </span>
              </span>
              <span className="tnum text-zinc-500">
                Put in {formatMoney(active.invested, currency)}
              </span>
              <span className={`tnum ${toneClass(gain)}`}>
                {gain >= 0 ? "Up" : "Down"} {formatMoney(Math.abs(gain), currency)} (
                {formatPercent(gainPct)})
              </span>
              {hoverIdx !== null && (
                <span className="tnum text-zinc-600">on {active.date}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex rounded-lg border border-zinc-700 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                range === r.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* overflow-hidden is the backstop: even if measurement ever fails, the
          page itself must never scroll sideways on a phone. */}
      <div ref={wrapRef} className="relative w-full overflow-hidden">
        {error ? (
          <p className="py-10 text-center text-sm text-rose-300">{error}</p>
        ) : points.length < 2 ? (
          <div className="py-10 text-center">
            <TrendingUp size={24} className="mx-auto text-zinc-700" />
            <p className="mt-2 text-sm text-zinc-400">
              {loading ? "Building your history…" : "Not enough history yet"}
            </p>
            {!loading && (
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-600">
                Once your holdings have a few days of prices behind them, the line
                will show up here.
              </p>
            )}
          </div>
        ) : (
          geom && (
            // Hold the previous render while refetching rather than flashing a skeleton.
            <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 150ms" }}>
              <svg
                ref={svgRef}
                width={width}
                height={height}
                className="touch-pan-y select-none"
                onMouseMove={(e) => handleMove(e.clientX)}
                onMouseLeave={() => setHoverIdx(null)}
                onTouchStart={(e) => handleMove(e.touches[0].clientX)}
                onTouchMove={(e) => handleMove(e.touches[0].clientX)}
                onTouchEnd={() => setHoverIdx(null)}
              >
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C_VALUE} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={C_VALUE} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Recessive hairline grid, solid — never dashed. */}
                {geom.ticks.map((t) => (
                  <g key={t}>
                    <line
                      x1={PAD.left}
                      x2={width - PAD.right}
                      y1={geom.y(t)}
                      y2={geom.y(t)}
                      stroke={C_GRID}
                      strokeWidth="1"
                    />
                    <text
                      x={PAD.left - 8}
                      y={geom.y(t) + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill={C_AXIS_TEXT}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {compactMoney(t, currency)}
                    </text>
                  </g>
                ))}

                <path d={geom.areaPath} fill="url(#valueFill)" />

                <path
                  d={geom.investedPath}
                  fill="none"
                  stroke={C_INVESTED}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={geom.valuePath}
                  fill="none"
                  stroke={C_VALUE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {xLabelIdx.map((i) => (
                  <text
                    key={i}
                    x={Math.min(
                      Math.max(geom.x(i), PAD.left + 12),
                      width - PAD.right - 12
                    )}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill={C_AXIS_TEXT}
                  >
                    {shortDate(points[i].date, spanDays)}
                  </text>
                ))}

                {hoverIdx !== null && points[hoverIdx] && (
                  <g pointerEvents="none">
                    <line
                      x1={geom.x(hoverIdx)}
                      x2={geom.x(hoverIdx)}
                      y1={PAD.top}
                      y2={PAD.top + geom.plotH}
                      stroke="#52525b"
                      strokeWidth="1"
                    />
                    {/* 2px surface ring keeps the markers legible over the lines. */}
                    <circle
                      cx={geom.x(hoverIdx)}
                      cy={geom.y(points[hoverIdx].invested)}
                      r="4"
                      fill={C_INVESTED}
                      stroke="#09090b"
                      strokeWidth="2"
                    />
                    <circle
                      cx={geom.x(hoverIdx)}
                      cy={geom.y(points[hoverIdx].value)}
                      r="4.5"
                      fill={C_VALUE}
                      stroke="#09090b"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Endpoint labels — selective direct labelling, not one per point. */}
                {hoverIdx === null && (
                  <g pointerEvents="none">
                    <circle
                      cx={geom.x(points.length - 1)}
                      cy={geom.y(points[points.length - 1].value)}
                      r="3.5"
                      fill={C_VALUE}
                      stroke="#09090b"
                      strokeWidth="2"
                    />
                    <circle
                      cx={geom.x(points.length - 1)}
                      cy={geom.y(points[points.length - 1].invested)}
                      r="3.5"
                      fill={C_INVESTED}
                      stroke="#09090b"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            </div>
          )
        )}
      </div>

      {/* A legend is always present for two series — identity never rests on colour alone. */}
      {points.length >= 2 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-2.5 text-[11px]">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: C_VALUE }}
            />
            What it&apos;s worth
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: C_INVESTED }}
            />
            What you put in
          </span>
          {first && (
            <span className="tnum ml-auto text-zinc-600">
              since {first.date}
            </span>
          )}
        </div>
      )}

      {data && data.incomplete.length > 0 && (
        <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-amber-200/70">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          No price history for {data.incomplete.join(", ")} — held flat at today&apos;s
          price in the line above.
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        The orange line is money you added, not growth. The gap between the two
        lines is what your investments actually earned.
      </p>
    </section>
  );
}
