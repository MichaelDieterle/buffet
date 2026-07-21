import { clsx } from "clsx";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import StockChart from "@/components/stock/StockChart";
import StockMetrics from "@/components/stock/StockMetrics";
import CompetitorTable from "@/components/stock/CompetitorTable";
import { getCompetitors, getHistory, getMetrics, getQuote } from "@/lib/api";

export const metadata: Metadata = {
  title: "Buffet - Stock Details",
  description: "Detailed stock analysis",
};

export default async function StockPage({
  params,
}: {
  params: { ticker: string };
}) {
  const { ticker } = params;

  // Fetch data in parallel
  const [quoteResult, metricsResult, historyResult, competitorsResult] = await Promise.allSettled([
    getQuote(ticker),
    getMetrics(ticker),
    getHistory(ticker),
    getCompetitors(ticker),
  ]);

  // Extract values or use undefined/null for rejected promises
  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : undefined;
  const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const history = historyResult.status === "fulfilled" ? historyResult.value : [];
  const competitors = competitorsResult.status === "fulfilled" ? competitorsResult.value : [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <nav className="mb-6 flex items-center space-x-4">
        <a href="/" className="text-blue-400 hover:text-blue-300">
          ? Back to Dashboard
        </a>
        <h1 className="text-2xl font-semibold">{ticker.toUpperCase()}</h1>
      </nav>

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        {/* Left column: Chart and Metrics */}
        <div className="space-y-8">
          <StockChart data={history} />
          <StockMetrics metrics={metrics} />
        </div>

        {/* Right column: Competitors */}
        <div>
          <CompetitorTable competitors={competitors} />
        </div>
      </div>
    </div>
  );
}
