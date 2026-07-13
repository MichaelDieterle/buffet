import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getQuote(ticker: string) {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/quote`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch quote for ${ticker}:`, error);
    // Return mock data
    return {
      symbol: ticker.toUpperCase(),
      price: Math.random() * 100 + 50, // random between 50-150
      change: (Math.random() - 0.5) * 10, // -5 to +5
      changeAbsolute: (Math.random() - 0.5) * 5,
      volume: Math.floor(Math.random() * 10000000),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getMetrics(ticker: string) {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/metrics`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch metrics for ${ticker}:`, error);
    return {
      peRatio: Math.random() * 30 + 10, // 10-40
      pbRatio: Math.random() * 5 + 1, // 1-6
      dividendYield: Math.random() * 0.05, // 0-5%
      eps: Math.random() * 5,
      marketCap: `$${(Math.random() * 2000).toFixed(1)}B`,
      beta: Math.random() * 2, // 0-2
      volume: Math.floor(Math.random() * 10000000),
      avgVolume: Math.floor(Math.random() * 10000000),
    };
  }
}

export async function getHistory(ticker: string, days = 30) {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/history?days=${days}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch history for ${ticker}:`, error);
    // Generate mock historical data
    const history = [];
    const basePrice = Math.random() * 100 + 50;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const open = basePrice + (Math.random() - 0.5) * 10;
      const high = open + Math.random() * 5;
      const low = open - Math.random() * 5;
      const close = open + (Math.random() - 0.5) * 10;
      const volume = Math.floor(Math.random() * 10000000);
      history.push({ date: date.toISOString().split('T')[0], open, high, low, close, volume });
    }
    return history;
  }
}

export async function getCompetitors(ticker: string) {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/competitors`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch competitors for ${ticker}:`, error);
    // Return mock competitors
    const mockCompetitors = [
      { ticker: "AAPL", name: "Apple Inc.", price: 175.43, change: 1.2 },
      { ticker: "MSFT", name: "Microsoft Corporation", price: 342.12, change: 0.8 },
      { ticker: "GOOGL", name: "Alphabet Inc.", price: 142.30, change: -0.5 },
    ].filter(c => c.ticker !== ticker.toUpperCase());
    return mockCompetitors;
  }
}
