"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StockChart from "@/components/stock/StockChart";
import StockMetrics from "@/components/stock/StockMetrics";
import CompetitorTable from "@/components/stock/CompetitorTable";
import Spinner from "@/components/ui/Spinner";
import { getQuote, getMetrics, getHistory, getCompetitors } from "@/lib/api";

interface Quote {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  exchangeName?: string;
  marketState?: string;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  marketCap: number | null;
}

export default function StockPage() {
  const params = useParams();
  const ticker = (params?.ticker as string ?? "").toUpperCase();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [history, setHistory] = useState<{ date: string; value: number }[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getQuote(ticker).catch(() => null),
      getMetrics(ticker).catch(() => null),
      getHistory(ticker, 90).catch(() => []),
      getCompetitors(ticker).catch(() => []),
    ]).then(([q, m, h, c]) => {
      setQuote(q);
      setMetrics(m);
      setHistory(
        (h as any[]).map((p: any) => ({ date: p.date, value: p.close })).reverse()
      );
      // Load real quotes for each competitor
      const competitorList = (c as any[]).map((comp: any) => ({
        ticker: comp.competitorSymbol,
        name: comp.competitorName,
        price: 0,
        change: 0,
      }));
      setCompetitors(competitorList);
      // Enrich with live prices in background
      competitorList.forEach(async (comp) => {
        try {
          const q = await getQuote(comp.ticker);
          if (q) {
            setCompetitors(prev => prev.map(c =>
              c.ticker === comp.ticker
                ? { ...c, price: q.price ?? 0, change: q.changePercent ?? 0 }
                : c
            ));
          }
        } catch { /* non-fatal */ }
      });
    }).catch((err) => {
      setError(err.message ?? "Fehler beim Laden");
    }).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner />
    </div>
  );

  if (error) return (
    <div className="text-red-400 text-center mt-20">{error}</div>
  );

  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const fmt = (n: number | null | undefined, d = 2) =>
    n == null || !Number.isFinite(n) ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const big = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (abs >= 1e9)  return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6)  return (n / 1e6).toFixed(2) + "M";
    return String(n);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">{ticker}</h1>
            {quote?.exchangeName && (
              <p className="text-gray-400 text-sm mt-1">{quote.exchangeName}</p>
            )}
          </div>
          {quote && (
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-100">
                ${fmt(quote.price)} <span className="text-lg font-normal text-gray-400">{quote.currency}</span>
              </p>
              <p className={`text-lg font-medium mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{fmt(quote.changePercent)}%
                {" "}({isPositive ? "+" : ""}{fmt(quote.change)})
              </p>
            </div>
          )}
        </div>
        {quote && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
            <div>
              <span className="text-gray-400">Tag-Hoch</span>
              <p className="text-gray-100 font-medium">{fmt(quote.dayHigh)}</p>
            </div>
            <div>
              <span className="text-gray-400">Tag-Tief</span>
              <p className="text-gray-100 font-medium">{fmt(quote.dayLow)}</p>
            </div>
            <div>
              <span className="text-gray-400">52W-Hoch</span>
              <p className="text-gray-100 font-medium">{fmt(quote.yearHigh)}</p>
            </div>
            <div>
              <span className="text-gray-400">52W-Tief</span>
              <p className="text-gray-100 font-medium">{fmt(quote.yearLow)}</p>
            </div>
            <div>
              <span className="text-gray-400">Volumen</span>
              <p className="text-gray-100 font-medium">{big(quote.volume)}</p>
            </div>
            <div>
              <span className="text-gray-400">Market Cap</span>
              <p className="text-gray-100 font-medium">{big(quote.marketCap)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {history.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Kursverlauf (90 Tage)</h2>
          <StockChart data={history} height={300} />
        </div>
      )}

      {/* Metrics + Competitors */}
      <div className="grid md:grid-cols-2 gap-6">
        <StockMetrics metrics={metrics} />
        <CompetitorTable competitors={competitors} />
      </div>
    </div>
  );
}
