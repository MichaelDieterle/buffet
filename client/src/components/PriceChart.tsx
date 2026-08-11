import { useEffect, useMemo, useState } from "react";
import { fetchHistory } from "../api";

type Point = { date: string; close: number };
type HistoryRow = { date: string; close?: number | null; adjClose?: number | null };

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1J", days: 365 },
];
const W = 640;
const H = 220;
const PAD = { top: 14, right: 12, bottom: 26, left: 52 };

function fmtPrice(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState(RANGES[1]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHistory(symbol, range.days)
      .then((rows: HistoryRow[]) => {
        if (cancelled) return;
        const pts = (Array.isArray(rows) ? rows : [])
          .map(r => ({ date: r.date, close: r.close ?? r.adjClose }))
          .filter((p): p is Point => p.close != null && Number.isFinite(p.close))
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        setPoints(pts);
      })
      .catch(() => { if (!cancelled) setPoints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, range]);

  const { areaPath, linePath, minY, maxY, grid, up } = useMemo(() => {
    if (points.length < 2) return { areaPath: "", linePath: "", minY: 0, maxY: 0, grid: [] as number[], up: true };
    const closes = points.map(p => p.close);
    let min = Math.min(...closes);
    let max = Math.max(...closes);
    const span = max - min;
    if (span < 1e-9) { min -= 1; max += 1; }
    const pad = span * 0.08;
    min -= pad;
    max += pad;
    const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
    const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.close).toFixed(1)}`);
    const line = "M" + pts.join(" L");
    const area = line + ` L${x(points.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;
    const ticks = 4;
    const g: number[] = [];
    for (let t = 0; t <= ticks; t++) g.push(min + (max - min) * (t / ticks));
    return { areaPath: area, linePath: line, minY: min, maxY: max, grid: g, up: closes[closes.length - 1] >= closes[0] };
  }, [points]);

  const start = points[0];
  const end = points[points.length - 1];
  const periodPct = start && end ? ((end.close - start.close) / start.close) * 100 : null;
  const color = up ? "#34d399" : "#f87171";

  return (
    <div className="chart">
      <div className="chart-head">
        <h4>Kursverlauf</h4>
        <div className="chart-ranges">
          {RANGES.map(r => (
            <button key={r.days} className={r.days === range.days ? "active" : ""} onClick={() => setRange(r)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="chart-empty">Lade Kursdaten...</div>
      ) : points.length < 2 ? (
        <div className="chart-empty">Keine Kursdaten verfügbar</div>
      ) : (
        <div className="chart-body">
          <div className="chart-stats">
            <div className="chart-stat">
              <span>Schlusskurs</span>
              <strong>{fmtPrice(end.close)}</strong>
            </div>
            <div className="chart-stat">
              <span>Zeitraum</span>
              <strong style={{ color }}>{periodPct != null ? (periodPct >= 0 ? "+" : "") + periodPct.toFixed(2) + "%" : "-"}</strong>
            </div>
            <div className="chart-stat">
              <span>Hoch</span>
              <strong>{fmtPrice(maxY)}</strong>
            </div>
            <div className="chart-stat">
              <span>Tief</span>
              <strong>{fmtPrice(minY)}</strong>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Kursverlauf ${symbol}`}>
            <defs>
              <linearGradient id={`grad-${symbol}-${range.days}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {grid.map((v, i) => {
              const y = PAD.top + (1 - (v - minY) / (maxY - minY)) * (H - PAD.top - PAD.bottom);
              return (
                <g key={i}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8a90a6">{fmtPrice(v)}</text>
                </g>
              );
            })}
            {areaPath && <path d={areaPath} fill={`url(#grad-${symbol}-${range.days})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {points.length > 1 && (
              <>
                <text x={PAD.left} y={H - 8} fontSize="11" fill="#8a90a6">
                  {new Date(start.date).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
                </text>
                <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="11" fill="#8a90a6">
                  {new Date(end.date).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
                </text>
              </>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
