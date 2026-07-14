import Badge from "@/components/ui/Badge";

interface StockCardProps {
  ticker: string;
  price?: number;
  change?: number;
}

export default function StockCard({ ticker, price = 0, change = 0 }: StockCardProps) {
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
        <span>Market Cap: — </span>
        <span>P/E: — </span>
      </div>
    </div>
  );
}