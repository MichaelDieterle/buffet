import { Badge } from "@/components/ui/Badge";

interface StockCardProps {
  ticker: string;
  // For demo, we could accept price and change, but we will fetch inside? Actually we will fetch via api in parent.
  // For simplicity, we accept price and change as optional.
  price?: number;
  change?: number;
}

export default function StockCard({ ticker, price, change }: StockCardProps) {
  // If not provided, we show placeholder
  const displayPrice = price ?? 0.0;
  const displayChange = change ?? 0.0;
  const isPositive = displayChange >= 0;

  return (
    <div className="group">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-100">{ticker.toUpperCase()}</h3>
        <Badge variant={isPositive ? "success" : "danger"} className="ml-2">
          {isPositive ? "+" : ""}{displayChange.toFixed(2)}%
        </Badge>
      </div>
      <p className="text-2xl font-bold text-gray-100">
        ${displayPrice.toFixed(2)}
      </p>
      <div className="mt-2 text-sm text-gray-400">
        {/* Placeholder for additional info like market cap */}
        <span>Market Cap: — </span>
        <span>P/E: — </span>
      </div>
    </div>
  );
}
