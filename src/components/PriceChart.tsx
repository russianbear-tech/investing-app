"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatMoney, formatPercent, toneClass } from "@/lib/format";
import { axisTimeLabel, compactMoney, niceTicks, pointLabel } from "@/lib/chart";

interface PricePoint {
  t: number;
  close: number;
}

interface PriceSeries {
  symbol: string;
  currency: string;
  range: string;
  points: PricePoint[];
  baseline: number | null;
}

const RANGES = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "all", label: "All" },
] as const;

const C_UP = "#34b27b";
const C_DOWN = "#d55181";
const C_GRID = "#27272a";
const C_AXIS_TEXT = "#71717a";
const C_COST = "#c98500";

const PAD = { top: 12, right: 10, bottom: 22, left: 46 };
const HEIGHT = 172;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Props {
  symbol: string;
  /**
   * Average cost per unit, drawn as a reference line. Omitted when the holding
   * was bought in a different currency than it trades in — the two numbers
   * would not be comparable, and a line at the wrong height reads as fact.
   */
  costLine?: number | null;
}

export default function PriceChart({ symbol, costLine }: Props) {
  const [range, setRange] = useState<string>("3m");
  const [data, setData] = useState<PriceSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(560);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Mirrors GrowthChart: a ResizeObserver alone misses some resizes, so the
  // window events back it up. Without them the viewBox keeps the width it was
  // first measured at and the chart renders stretched after a rotation.
  useIsoLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.max(220, Math.round(w)));
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
    setError(null);
    setHoverIdx(null);

    (async () => {
      try {
        const params = new URLSearchParams({ symbol, range });
        const res = await fetch(`/api/symbol-history?${params}`, { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? "Could not load the chart.");
        setData(body.series);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the chart.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const points = useMemo(() => data?.points ?? [], [data]);

  const geom = useMemo(() => {
    if (points.length < 2) return null;

    const innerW = Math.max(width - PAD.left - PAD.right, 10);
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const closes = points.map((p) => p.close);
    let lo = Math.min(...closes);
    let hi = Math.max(...closes);

    // Only draw the cost line if it lands near the price range. Forcing the
    // axis open to reach a far-away cost would squash the price into a
    // straight line and lose the shape entirely.
    const spread = hi - lo || Math.abs(hi) * 0.02 || 1;
    const showCost =
      costLine != null &&
      Number.isFinite(costLine) &&
      costLine > lo - spread * 1.5 &&
      costLine < hi + spread * 1.5;

    if (showCost && costLine != null) {
      lo = Math.min(lo, costLine);
      hi = Math.max(hi, costLine);
    }

    // A perfectly flat series would divide by zero.
    if (hi - lo < 1e-9) {
      const pad = Math.abs(hi) * 0.01 || 1;
      lo -= pad;
      hi += pad;
    } else {
      const pad = (hi - lo) * 0.08;
      lo -= pad;
      hi += pad;
    }

    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const spanDays = (t1 - t0) / 86_400_000;

    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;

    const line = points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(2)},${y(p.close).toFixed(2)}`
      )
      .join(" ");
    const base = (PAD.top + innerH).toFixed(2);
    const area = `${line} L${x(t1).toFixed(2)},${base} L${x(t0).toFixed(2)},${base} Z`;

    // Ask for more ticks until at least a couple land inside the range. The
    // step ladder jumps 20 -> 50 with nothing between, so a narrow price
    // window can ask for 4 gridlines and be handed exactly one, which reads as
    // a broken chart rather than a tidy one.
    let ticks: number[] = [];
    for (const want of [4, 6, 8]) {
      ticks = niceTicks(lo, hi, want).filter((t) => t >= lo && t <= hi);
      if (ticks.length >= 3) break;
    }

    // Four evenly spaced labels, snapped to real data points.
    const labelIdx: number[] = [];
    const step = (points.length - 1) / 3;
    for (let i = 0; i < 4; i++) labelIdx.push(Math.round(i * step));

    return {
      innerW,
      innerH,
      x,
      y,
      line,
      area,
      ticks,
      spanDays,
      showCost,
      t0,
      t1,
      labelIdx,
    };
  }, [points, width, costLine]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!geom || points.length === 0 || !svgRef.current) return;
      const box = svgRef.current.getBoundingClientRect();
      const px = ((clientX - box.left) / box.width) * width;
      const frac = (px - PAD.left) / geom.innerW;
      const targetT = geom.t0 + frac * (geom.t1 - geom.t0);

      let best = 0;
      let bestGap = Infinity;
      for (let i = 0; i < points.length; i++) {
        const gap = Math.abs(points[i].t - targetT);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      }
      setHoverIdx(best);
    },
    [geom, points, width]
  );

  const last = points.length > 0 ? points[points.length - 1].close : null;
  const shown = hoverIdx !== null ? points[hoverIdx] : null;
  const baseline = data?.baseline ?? (points.length > 0 ? points[0].close : null);
  const shownClose = shown?.close ?? last;

  const change = shownClose != null && baseline != null ? shownClose - baseline : null;
  const changePct = change != null && baseline ? (change / baseline) * 100 : null;
  const up = (change ?? 0) >= 0;
  const stroke = up ? C_UP : C_DOWN;
  const cur = data?.currency ?? "USD";

  // ids have to be unique per chart or two open holdings share one gradient
  const fillId = `pcfill-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum text-lg font-semibold text-zinc-50">
            {shownClose != null ? formatMoney(shownClose, cur) : "—"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {shown ? (
              <span className="tnum">{pointLabel(shown.t, geom?.spanDays ?? 0)}</span>
            ) : change != null && changePct != null ? (
              <>
                <span className={`tnum ${toneClass(change)}`}>
                  {change >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(change), cur)} ({formatPercent(changePct)})
                </span>{" "}
                <span className="text-zinc-600">
                  {range === "1d" ? "today" : `over ${range.toUpperCase()}`}
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        {loading && (
          <Loader2 size={13} className="mt-1 shrink-0 animate-spin text-zinc-600" />
        )}
      </div>

      <div ref={boxRef} className="mt-2">
        {error ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center text-[11px] text-zinc-500">
            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
            {error}
          </p>
        ) : points.length < 2 ? (
          <p className="py-8 text-center text-[11px] leading-relaxed text-zinc-600">
            {loading
              ? "Loading…"
              : `Not enough price points over this range — ${symbol} doesn't trade often enough to draw a line. Try a longer one.`}
          </p>
        ) : (
          geom && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width="100%"
              height={HEIGHT}
              className="touch-pan-y select-none"
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={(e) => handleMove(e.touches[0].clientX)}
              onTouchMove={(e) => handleMove(e.touches[0].clientX)}
              onTouchEnd={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>

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
                    x={PAD.left - 6}
                    y={geom.y(t) + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill={C_AXIS_TEXT}
                    className="tnum"
                  >
                    {compactMoney(t, cur)}
                  </text>
                </g>
              ))}

              <path d={geom.area} fill={`url(#${fillId})`} />
              <path
                d={geom.line}
                fill="none"
                stroke={stroke}
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {geom.showCost && costLine != null && (
                <g>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={geom.y(costLine)}
                    y2={geom.y(costLine)}
                    stroke={C_COST}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.75"
                  />
                  <text
                    x={width - PAD.right}
                    y={geom.y(costLine) - 4}
                    textAnchor="end"
                    fontSize="8.5"
                    fill={C_COST}
                  >
                    what you paid
                  </text>
                </g>
              )}

              {shown && (
                <g>
                  <line
                    x1={geom.x(shown.t)}
                    x2={geom.x(shown.t)}
                    y1={PAD.top}
                    y2={PAD.top + geom.innerH}
                    stroke={C_AXIS_TEXT}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={geom.x(shown.t)}
                    cy={geom.y(shown.close)}
                    r="3"
                    fill={stroke}
                    stroke="#09090b"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {geom.labelIdx.map((i, n) => {
                const p = points[i];
                if (!p) return null;
                return (
                  <text
                    key={`${i}-${n}`}
                    x={geom.x(p.t)}
                    y={HEIGHT - 6}
                    textAnchor={n === 0 ? "start" : n === 3 ? "end" : "middle"}
                    fontSize="9"
                    fill={C_AXIS_TEXT}
                  >
                    {axisTimeLabel(p.t, geom.spanDays)}
                  </text>
                );
              })}
            </svg>
          )
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
              range === r.key
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
