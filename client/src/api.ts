import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function fetchQuote(symbol: string) {
  try {
    return await api.get(`/stocks/${symbol}/quote`).then(r => r.data);
  } catch (error: any) {
    try {
      const rows = await fetchHistory(symbol, 7);
      const latest = Array.isArray(rows) ? [...rows].sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0] : null;
      if (latest?.close != null) return { symbol, price: Number(latest.close), previousClose: Number(latest.close), change: 0, changePercent: 0, currency: latest.currency || 'USD', timestamp: latest.date };
    } catch { /* preserve original error */ }
    throw error;
  }
}
export async function fetchFundamentals(symbol: string) { return api.get(`/stocks/${symbol}/fundamentals`).then(r => r.data); }
export async function fetchNews(symbol: string) { return api.get(`/stocks/${symbol}/news`).then(r => r.data); }
export async function fetchCalendar(symbol: string) { return api.get(`/stocks/${symbol}/calendar`).then(r => r.data); }
export async function refreshStock(symbol: string) { return api.post(`/stocks/${symbol}/refresh`).then(r => r.data); }
export async function searchYahoo(query: string) { return api.get(`/stocks/search/${encodeURIComponent(query)}`).then(r => r.data); }
export async function createStock(payload: { symbol: string; name: string; sector?: string; industry?: string }) { return api.post('/stocks', payload).then(r => r.data); }
export async function deleteStock(symbol: string) { return api.delete(`/stocks/${symbol}`).then(r => r.data); }
export function exportCsvUrl(symbol: string) { return `/api/stocks/${symbol}/export.csv`; }
export async function fetchIndicators(symbol: string) { return api.get(`/stocks/${symbol}/indicators`).then(r => r.data); }
export async function importPortfolio(file: File) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  // Let the browser set the multipart boundary. Manually setting Content-Type can cause mobile network errors.
  return api.post('/portfolios/import', formData).then(r => r.data);
}
export default api;
