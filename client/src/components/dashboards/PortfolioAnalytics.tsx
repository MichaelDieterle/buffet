import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface Holding {
  ticker: string;
  currentValue: number;
  profit: number;
  sector: string;
}

interface PortfolioAnalyticsProps {
  holdings: Holding[];
  sectorDistribution: Record<string, number>;
  totalValue: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function formatCurrency(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value ?? 0);
  return `${number.toLocaleString()} €`;
}

export function PortfolioAnalytics({ holdings, sectorDistribution }: PortfolioAnalyticsProps) {
  const sectorData = Object.entries(sectorDistribution).map(([name, value]) => ({ name, value }));
  const performanceData = holdings.map(h => ({ ticker: h.ticker, profit: h.profit }));

  return (
    <div className="portfolio-analytics">
      <div className="analytics-grid">
        <div className="analytics-card">
          <h4>Sector Allocation</h4>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {sectorData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={formatCurrency} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card">
          <h4>Profit/Loss per Asset</h4>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ticker" />
                <YAxis />
                <Tooltip formatter={formatCurrency} />
                <Legend />
                <Bar dataKey="profit" fill="#82ca9d" name="Profit/Loss" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
