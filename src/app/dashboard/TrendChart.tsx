"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { formatMoney, formatMoneyWhole } from "@/lib/formatMoney";

export interface TrendPoint {
  date: string; // yyyy-MM-dd
  turns: number | null;
  incomePerDay: number | null;
}

// Color tracks relative position to the current month (not the calendar month
// itself), so it stays consistent as the dashboard's "current" period moves
// forward over time: current month is always blue, one month back always
// green, two months back always amber.
const MONTH_COLORS = ["#2563eb", "#10b981", "#f59e0b"];

const H = 220;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 28;
const PLOT_H = H - PAD_T - PAD_B;
const DEFAULT_WIDTH = 640;

function xForDay(day: number, plotW: number): number {
  return PAD_L + ((day - 1) / 30) * plotW;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<"turns" | "incomePerDay">("turns");

  // The viewBox width tracks the container's real measured pixel width (not a
  // fixed design width scaled to fit) — otherwise 1 SVG unit maps to a
  // different number of actual pixels on a phone (narrow container, big
  // scale-down) than on a desktop dashboard (wide container, little
  // scale-down), so a single font-size constant can never look right at both
  // sizes: it was rendering as ~5px, unreadable, at phone widths. Measuring
  // the real width keeps 1 unit == 1px everywhere, so fixed font sizes below
  // stay legible regardless of screen size.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Measure synchronously right away — don't wait on ResizeObserver's first
    // callback, whose timing (especially on an initially-backgrounded tab)
    // isn't guaranteed to happen before paint.
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plotW = Math.max(width - PAD_L - PAD_R, 1);

  const months = useMemo(() => {
    const byMonth = new Map<string, TrendPoint[]>();
    for (const p of points) {
      const key = p.date.slice(0, 7);
      const arr = byMonth.get(key) ?? [];
      arr.push(p);
      byMonth.set(key, arr);
    }
    // Most recent month first, capped at 3 (current, -1, -2).
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 3)
      .map(([key, pts], i) => ({
        key,
        label: format(parseISO(`${key}-01`), "MMMM yyyy"),
        color: MONTH_COLORS[i],
        points: pts
          .filter((p) => p[metric] !== null)
          .map((p) => ({ day: parseISO(p.date).getDate(), value: p[metric] as number }))
          .sort((a, b) => a.day - b.day),
      }));
  }, [points, metric]);

  const allValues = months.flatMap((m) => m.points.map((p) => p.value));
  const maxValue = allValues.length ? Math.max(...allValues) * 1.15 : 1;

  function yFor(value: number): number {
    return PAD_T + PLOT_H - (value / maxValue) * PLOT_H;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: yFor(maxValue * f),
    label:
      metric === "turns" ? (maxValue * f).toFixed(1) : formatMoneyWhole(maxValue * f),
  }));

  const dayTicks = Array.from({ length: 31 }, (_, i) => i + 1);
  // Labeling all 31 days packs numbers so tight they become illegible on a
  // narrow screen — gridlines stay for every day, but only a handful of days
  // get an actual number under them.
  const labeledDays = new Set([1, 5, 10, 15, 20, 25, 30]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">Trend</h2>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5">
          <button
            type="button"
            onClick={() => setMetric("turns")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              metric === "turns" ? "bg-blue-600 text-white" : "text-neutral-600"
            }`}
          >
            Turns
          </button>
          <button
            type="button"
            onClick={() => setMetric("incomePerDay")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              metric === "incomePerDay" ? "bg-blue-600 text-white" : "text-neutral-600"
            }`}
          >
            Avg income/day
          </button>
        </div>
      </div>

      {months.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">No data yet.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            {months.map((m) => (
              <span key={m.key} style={{ color: m.color }}>
                ● {m.label}
              </span>
            ))}
          </div>

          <div ref={containerRef} className="w-full">
            <svg
              viewBox={`0 0 ${width} ${H}`}
              width="100%"
              height={H}
              role="img"
              aria-label="Trend chart"
            >
              {/* horizontal gridlines + y-axis labels */}
              {yTicks.map((t) => (
                <g key={t.y}>
                  <line x1={PAD_L} y1={t.y} x2={width - PAD_R} y2={t.y} stroke="#e5e5e5" strokeWidth={1} />
                  <text x={PAD_L - 6} y={t.y + 4} fontSize={11} fill="#737373" textAnchor="end">
                    {t.label}
                  </text>
                </g>
              ))}

              {/* vertical gridline + day label for every day */}
              {dayTicks.map((day) => (
                <g key={day}>
                  <line
                    x1={xForDay(day, plotW)}
                    y1={PAD_T}
                    x2={xForDay(day, plotW)}
                    y2={H - PAD_B + 4}
                    stroke="#eeeeee"
                    strokeWidth={1}
                  />
                  {labeledDays.has(day) && (
                    <text
                      x={xForDay(day, plotW)}
                      y={H - PAD_B + 18}
                      fontSize={11}
                      fill="#737373"
                      textAnchor="middle"
                    >
                      {day}
                    </text>
                  )}
                </g>
              ))}

              <line x1={PAD_L} y1={H - PAD_B} x2={width - PAD_R} y2={H - PAD_B} stroke="#cccccc" strokeWidth={1} />
              <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cccccc" strokeWidth={1} />

              {months.map((m) => (
                <g key={m.key}>
                  <polyline
                    fill="none"
                    stroke={m.color}
                    strokeWidth={2}
                    points={m.points.map((p) => `${xForDay(p.day, plotW)},${yFor(p.value)}`).join(" ")}
                  />
                  {m.points.map((p) => (
                    <circle
                      key={p.day}
                      cx={xForDay(p.day, plotW)}
                      cy={yFor(p.value)}
                      r={4}
                      fill={m.color}
                      stroke="#fff"
                      strokeWidth={1.5}
                    >
                      <title>
                        {m.label} {p.day}:{" "}
                        {metric === "turns" ? p.value.toFixed(1) : formatMoney(p.value)}
                      </title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </section>
  );
}
