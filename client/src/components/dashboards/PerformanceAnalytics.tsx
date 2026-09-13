import { useEffect, useMemo, useState } from "react";
import { fetchPerformance } from "../../api";

type Period = "m1" | "m3" | "m6" | "y1" | "all";

type Perf = {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  performance: {
    price: number;
    high: number;
    low: number;
    changeAll: number | null;
    changeM1: number | null;
    changeM3: number | null;
    changeM6: number | null;
    changeY1: number | null;
    maxDrawdown: number | null;
    volatility: number | null;
    fromHigh: number | null;
    fromLow: number | null;
    points: number;
  } | null;
};

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

function sparkline(p: Perf["performance"]) {
  if (!p) return 0;
  const v = (p.changeAll ?? 0) + 0.5;
  return Math.max(4, Math.min(100, v * 40));
}

const changeKey: Record<Period, keyof NonNullable<Perf["performance"]>> = {
  m1: "changeM1",
  m3: "changeM3",
  m6: "changeM6",
  y1: "changeY1",
  all: "changeAll",
};

export default function PerformanceAnalytics() {
  const [rows, setRows] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("m3");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPerformance()
      .then((data: Perf[]) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    const key = changeKey[period];
    return [...rows].sort((a, b) => {
      const av = a.performance?.[key] ?? null;
      const bv = b.performance?.[key] ?? null;
      return (bv ?? -Infinity) - (av ?? -Infinity);
    });
  }, [rows, period]);

  const avg = useMemo(() => {
    const vals = rows
      .map((r) => r.performance?.changeM3)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [rows]);

  if (loading) return <div className="dash-loading">Lade Performance-Analytics...</div>;
  if (error) return <div className="dash-error">Fehler: {error}</div>;

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h3>Performance Analytics</h3>
          <p className="muted">
            Rendite, Drawdown und Volatilität — Ø (3M): <strong>{pct(avg)}</strong>
          </p>
        </div>
        <div className="dash-filters">
          {(
            [
              ["m1", "1M"],
              ["m3", "3M"],
              ["m6", "6M"],
              ["y1", "1J"],
              ["all", "Gesamt"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={period === k ? "active" : ""}
              onClick={() => setPeriod(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="empty">
          Keine Kurshistorie verfügbar. Klicke bei einer Aktie auf „Daten aktualisieren", um Verläufe zu laden.
        </div>
      ) : (
        <div className="perf-list">
          {ranked.map((r) => {
            const p = r.performance;
            if (!p) return null;

            const change = p[changeKey[period]] as number | null;
            const positive = (change ?? 0) >= 0;

            return (
              <div className="perf-row" key={r.id}>
                <div className="perf-ident">
                  <strong>{r.symbol}</strong>
                  <span className="muted">{r.name}</span>
                </div>
                <div className="perf-bar-wrap">
                  <div
                    className="perf-bar"
                    style={{
                      width: sparkline(p) + "%",
                      background: positive ? "var(--green,#34d399)" : "var(--red,#f87171)",
                    }}
                  />
                </div>
                <div className="perf-metrics">
                  <div className="perf-metric">
                    <span>Rendite ({period === "all" ? "Gesamt" : period.replace("m", "") + "M"})</span>
                    <strong className={positive ? "up" : "down"}>{pct(change)}</strong>
                  </div>
                  <div className="perf-metric">
                    <span>Max. Drawdown</span>
                    <strong>{pct(p.maxDrawdown)}</strong>
                  </div>
                  <div className="perf-metric">
                    <span>Volatilität</span>
                    <strong>{pct(p.volatility)}</strong>
                  </div>
                  <div className="perf-metric">
                    <span>vom Hoch</span>
                    <strong>{pct(p.fromHigh)}</strong>
                  </div>
                  <div className="perf-metric">
                    <span>vom Tief</span>
                    <strong>{pct(p.fromLow)}</strong>
                  </div>
                  <div className="perf-metric">
                    <span>Punkte</span>
                    <strong>{p.points}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Vercel build verification marker.
