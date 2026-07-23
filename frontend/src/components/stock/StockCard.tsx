import Badge from "@/components/ui/Badge";

interface StockCardProps {
  ticker: string;
  price?: number;
  change?: number;
  marketCap?: number | null;
  peRatio?: number | null;
}

function big(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9)  return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6)  return (n / 1e6).toFixed(2) + "M";
  return String(n);
}

export default function StockCard({ ticker, price = 0, change = 0, marketCap, peRatio }: StockCardProps) {
  const isPositive = change >= 0;
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col h-full">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-100">{ticker.toUpperCase()}</h3>
        <Badge variant={isPositive ? "success" : "danger"} className="ml-2">
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </Badge>
      </div>
      <p className="text-2xl font-bold text-gray-100">${price.toFixed(2)}</p>
      <div className="mt-2 text-sm text-gray-400">
        <span>Market Cap: {big(marketCap)} </span>
        <span>P/E: {peRatio != null ? peRatio.toFixed(2) : "—"}</span>
      </div>
    </div>
  );
}
