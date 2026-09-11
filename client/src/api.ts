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
  return api.get(`/stocks/search/${query}`).then(r => r.data);
}
export async function createStock(payload: { symbol: string; name: string; sector?: string; industry?: string }) {
  return api.post('/stocks', payload).then(r => r.data);
}
export async function deleteStock(symbol: string) {
  return api.delete(`/stocks/${symbol}`).then(r => r.data);
}
export function exportCsvUrl(symbol: string) {
  return `/api/stocks/${symbol}/export.csv`;
}
export async function fetchIndicators(symbol: string) {
  return api.get(`/stocks/${symbol}/indicators`).then(r => r.data);
}
export async function fetchHistory(symbol: string, days = 90) {
  return api.get(`/stocks/${symbol}/history`, { params: { days } }).then(r => r.data);
}

// ── Analytics ────────────────────────────────────────────────────────────────
export async function fetchEarnings() {
  return api.get('/analytics/earnings').then(r => r.data);
}
export async function fetchPerformance() {
  return api.get('/analytics/performance').then(r => r.data);
}
export async function fetchScores() {
  return api.get('/analytics/scores').then(r => r.data);
}
export async function fetchNewsFeed(type?: string) {
  return api.get('/analytics/news', { params: type ? { type } : {} }).then(r => r.data);
}
export async function fetchCompare(symbols: string[]) {
  return api.get('/analytics/compare', { params: { symbols: symbols.join(',') } }).then(r => r.data);
}

// ── Comparisons ──────────────────────────────────────────────────────────────
export async function listComparisons() {
  return api.get('/comparisons').then(r => r.data);
}
export async function createComparison(payload: { name: string; description?: string }) {
  return api.post('/comparisons', payload).then(r => r.data);
}
export async function getComparison(id: number) {
  return api.get(`/comparisons/${id}`).then(r => r.data);
}
export async function updateComparison(id: number, payload: { name?: string; description?: string }) {
  return api.patch(`/comparisons/${id}`, payload).then(r => r.data);
}
export async function addComparisonStock(id: number, stockId: number) {
  return api.post(`/comparisons/${id}/stocks`, { stockId }).then(r => r.data);
}
export async function removeComparisonStock(id: number, stockId: number) {
  return api.delete(`/comparisons/${id}/stocks/${stockId}`).then(r => r.data);
}
export async function deleteComparison(id: number) {
  return api.delete(`/comparisons/${id}`).then(r => r.data);
}

export default api;