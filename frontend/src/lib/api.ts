import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function getQuote(ticker: string) {
  const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/quote`);
  return data;
}

export async function getMetrics(ticker: string) {
  const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/fundamentals`);
  return data;
}

export async function getHistory(ticker: string, days = 30) {
  const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/history?days=${days}`);
  return data;
}

export async function getCompetitors(ticker: string) {
  const { data } = await axios.get(`${BASE_URL}/api/stocks/${ticker}/competitors`);
  return data;
}
