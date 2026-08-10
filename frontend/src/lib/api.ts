import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });

export async function getQuote(ticker: string) {
  const { data } = await api.get(`/api/stocks/${ticker}/quote`);
  return data;
}

export async function getMetrics(ticker: string) {
  const { data } = await api.get(`/api/stocks/${ticker}/fundamentals`);
  return data;
}

export async function getHistory(ticker: string, days = 30) {
  const { data } = await api.get(`/api/stocks/${ticker}/history?days=${days}`);
  return data;
}

export async function getCompetitors(ticker: string) {
  const { data } = await api.get(`/api/stocks/${ticker}/competitors`);
  return data;
}

export async function getNews(ticker: string) {
  const { data } = await api.get(`/api/stocks/${ticker}/news`);
  return data;
}

export async function getCalendar(ticker: string) {
  const { data } = await api.get(`/api/stocks/${ticker}/calendar`);
  return data;
}

export function exportUrl(ticker: string) {
  return `${BASE_URL}/api/stocks/${ticker}/export.csv`;
}
