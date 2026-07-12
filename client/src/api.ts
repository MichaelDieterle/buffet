import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export async function fetchQuote(symbol: string) {
  return api.get(`/stocks/${symbol}/quote`).then(r => r.data);
}
export async function fetchFundamentals(symbol: string) {
  return api.get(`/stocks/${symbol}/fundamentals`).then(r => r.data);
}
export async function fetchNews(symbol: string) {
  return api.get(`/stocks/${symbol}/news`).then(r => r.data);
}
export async function fetchCalendar(symbol: string) {
  return api.get(`/stocks/${symbol}/calendar`).then(r => r.data);
}
export async function refreshStock(symbol: string) {
  return api.post(`/stocks/${symbol}/refresh`).then(r => r.data);
}
export async function searchYahoo(query: string) {
  return api.get(`/stocks/search/${encodeURIComponent(query)}`).then(r => r.data);
}
export async function createStock(payload: { symbol: string; name: string; sector?: string; industry?: string }) {
  return api.post('/stocks', payload).then(r => r.data);
}
export function exportCsvUrl(symbol: string) {
  return `/api/stocks/${encodeURIComponent(symbol)}/export.csv`;
}

export default api;
