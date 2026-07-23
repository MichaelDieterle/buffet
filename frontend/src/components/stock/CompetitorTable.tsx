interface Competitor {
  ticker: string;
  name: string;
  price: number;
  change: number; // percentage
}

interface CompetitorTableProps {
  competitors: Competitor[];
}

export default function CompetitorTable({ competitors }: CompetitorTableProps) {
  if (!competitors || competitors.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-100">Competitors</h2>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-100">Competitors</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Change %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {competitors.map((comp) => {
              const isPositive = comp.change >= 0;
              return (
                <tr key={comp.ticker} className="hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-100">
                    {comp.ticker.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-100">{comp.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-100">${comp.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={isPositive ? "text-green-400" : "text-red-400"}>
                      {comp.change >= 0 ? "+" : ""}{comp.change.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
