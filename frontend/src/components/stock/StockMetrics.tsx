interface StockMetricsProps {
  metrics: {
    peRatio?: number | null;
    pbRatio?: number | null;
    dividendYield?: number | null;
    eps?: number | null;
    marketCap?: string | null;
    beta?: number | null;
  } | null;
}

export default function StockMetrics({ metrics }: StockMetricsProps) {
  if (!metrics) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-100">Key Metrics</h2>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const { peRatio, pbRatio, dividendYield, eps, marketCap, beta } = metrics;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-100">Key Metrics</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">P/E Ratio</span>
          <span className="text-gray-100">{peRatio !== null ? peRatio.toFixed(2) : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">P/B Ratio</span>
          <span className="text-gray-100">{pbRatio !== null ? pbRatio.toFixed(2) : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Dividend Yield</span>
          <span className="text-gray-100">{dividendYield !== null ? `${(dividendYield * 100).toFixed(2)}%` : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">EPS</span>
          <span className="text-gray-100">{eps !== null ? eps.toFixed(2) : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Beta</span>
          <span className="text-gray-100">{beta !== null ? beta.toFixed(2) : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Market Cap</span>
          <span className="text-gray-100">{marketCap ?? "N/A"}</span>
        </div>
      </div>
    </div>
  );
}
