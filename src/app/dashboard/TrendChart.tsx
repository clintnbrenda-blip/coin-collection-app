"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

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

const W = 640;
const H = 220;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function xForDay(day: number): number {
  return PAD_L + ((day - 1) / 30) * PLOT_W;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<"turns" | "incomePerDay">("turns");

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
      metric === "turns" ? (maxValue * f).toFixed(1) : `$${Math.round(maxValue * f)}`,
  }));

  const dayTicks = Array.from({ length: 31 }, (_, i) => i + 1);

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

          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Trend chart">
            {/* horizontal gridlines + y-axis labels */}
            {yTicks.map((t) => (
              <g key={t.y}>
                <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#e5e5e5" strokeWidth={1} />
                <text x={PAD_L - 6} y={t.y + 3} fontSize={9} fill="#a3a3a3" textAnchor="end">
                  {t.label}
                </text>
              </g>
            ))}

            {/* vertical gridline + day label for every day */}
            {dayTicks.map((day) => (
              <g key={day}>
                <line
                  x1={xForDay(day)}
                  y1={PAD_T}
                  x2={xForDay(day)}
                  y2={H - PAD_B + 4}
                  stroke="#eeeeee"
                  strokeWidth={1}
                />
                <text
                  x={xForDay(day)}
                  y={H - PAD_B + 13}
                  fontSize={7}
                  fill="#a3a3a3"
                  textAnchor="middle"
                >
                  {day}
                </text>
              </g>
            ))}

            <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#cccccc" strokeWidth={1} />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cccccc" strokeWidth={1} />

            {months.map((m) => (
              <g key={m.key}>
                <polyline
                  fill="none"
                  stroke={m.color}
                  strokeWidth={2}
                  points={m.points.map((p) => `${xForDay(p.day)},${yFor(p.value)}`).join(" ")}
                />
                {m.points.map((p) => (
                  <circle
                    key={p.day}
                    cx={xForDay(p.day)}
                    cy={yFor(p.value)}
                    r={4}
                    fill={m.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  >
                    <title>
                      {m.label} {p.day}:{" "}
                      {metric === "turns" ? p.value.toFixed(2) : `$${p.value.toFixed(2)}`}
                    </title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
        </>
      )}
    </section>
  );
}
