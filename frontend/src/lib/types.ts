// src/lib/types.ts

export interface Stock {
  ticker: string;
  name: string;
}

export interface Quote {
  symbol: string;
  price: number | null;
  change: number | null;          // absolute price change (e.g. +1.23)
  changePercent: number | null;   // percentage change (e.g. 0.52 for 0.52%)
  currency: string;
  volume: number | null;
  marketCap: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  previousClose: number | null;
  exchangeName?: string | null;
  marketState?: string | null;
  timestamp?: string | null;
}

export interface Metrics {
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;   // as decimal (e.g., 0.02 for 2%)
  eps: number | null;
  marketCap: number | null;       // raw number from API
  beta: number | null;
  revenue: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  recommendationKey: string | null;
}

export interface Competitor {
  ticker: string;
  name: string;
  price: number;
  change: number;                 // percentage
}

export interface HistoricalData {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjClose: number | null;
}
