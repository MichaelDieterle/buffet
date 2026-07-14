import type { Metadata } from "next";
import Link from "next/link";
import StockCard from "@/components/stock/StockCard";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Buffet - Dashboard",
  description: "Stock Market Review Dashboard",
};

export default function Home() {
  const tickers = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-8">Buffet - Stock Market Review</h1>
      <Navbar />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tickers.map((ticker) => (
          <Link key={ticker} href={`/stock/${ticker}`} className="hover:opacity-90 transition-opacity">
            <StockCard ticker={ticker} />
          </Link>
        ))}
      </div>
    </div>
  );
}
