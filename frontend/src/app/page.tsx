"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StockCard from "@/components/stock/StockCard";
import { getQuote } from "@/lib/api";

interface StockQuote {
  ticker: string;
  price: number;
  change: number;
}

const TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"];

export default function Home() {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});

  useEffect(() => {
    TICKERS.forEach(async (ticker) => {
      try {
        const data = await getQuote(ticker);
        if (data) {
          setQuotes(prev => ({
            ...prev,
            [ticker]: { ticker, price: data.price ?? 0, change: data.changePercent ?? 0 },
          }));
        }
      } catch {
        // keep default 0 values on error
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-8">Buffet – Stock Market Review</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TICKERS.map((ticker) => (
          <Link key={ticker} href={`/stock/${ticker}`} className="hover:opacity-90 transition-opacity">
            <StockCard
              ticker={ticker}
              price={quotes[ticker]?.price ?? 0}
              change={quotes[ticker]?.change ?? 0}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
