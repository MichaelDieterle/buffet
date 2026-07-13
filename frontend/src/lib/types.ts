// src/lib/types.ts

export interface Stock {
  ticker: string;
  name: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number; // percentage change
  changeAbsolute: number;
  volume: number;
  timestamp: string;
}

export interface Metrics {
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null; // as decimal (e.g., 0.02 for 2%)
  eps: number | null;
  marketCap: string; // formatted string like "1.2T"
  beta: number | null;
  volume: number;
  avgVolume: number;
}

export interface Competitor {
  ticker: string;
  name: string;
  price: number;
  change: number; // percentage
  marketCap: string;
}

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
