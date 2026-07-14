import React, { useEffect, useState } from "react";
import { fetchIndicators } from "../api";

interface IndicatorProps {
  symbol: string;
}

export const Indicator: React.FC<IndicatorProps> = ({ symbol }) => {
  const [indicators, setIndicators] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchIndicators(symbol);
        setIndicators(data?.indicators ?? null);
      } catch (err: any) {
        setError(err?.message || "Failed to load indicators");
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      load();
    }
  }, [symbol]);

  if (loading) return <div>Loading indicators...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!indicators) return <div>No data available</div>;

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null || !Number.isFinite(num)) return "-";
    return num.toString();
  };

  return (
    <div className="grid">
      <div className="card">
        <h4>Moving Averages</h4>
        <div className="kv"><span>SMA 20</span><strong>{formatNumber(indicators.sma_20)}</strong></div>
        <div className="kv"><span>SMA 50</span><strong>{formatNumber(indicators.sma_50)}</strong></div>
        <div className="kv"><span>EMA 12</span><strong>{formatNumber(indicators.ema_12)}</strong></div>
        <div className="kv"><span>EMA 26</span><strong>{formatNumber(indicators.ema_26)}</strong></div>
      </div>

      <div className="card">
        <h4>Momentum</h4>
        <div className="kv"><span>RSI (14)</span><strong>{formatNumber(indicators.rsi)}</strong></div>
      </div>

      <div className="card">
        <h4>MACD</h4>
        <div className="kv"><span>MACD</span><strong>{formatNumber(indicators.macd)}</strong></div>
        <div className="kv"><span>Signal</span><strong>{formatNumber(indicators.macd_signal)}</strong></div>
        <div className="kv"><span>Histogram</span><strong>{formatNumber(indicators.macd_hist)}</strong></div>
      </div>
    </div>
  );
};
