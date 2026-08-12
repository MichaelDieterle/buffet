import axios from 'axios';

const TOKEN_KEY = 'buffet_token';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (
      error?.response?.status === 401 &&
      !String(error.config?.url || '').includes('/auth/login')
    ) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/') window.location.reload();
    }
    return Promise.reject(error);
  }
);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function login(password: string): Promise<{ token: string | null; disabled: boolean }> {
  return api.post('/auth/login', { password }).then((r) => r.data);
}

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

export default api;
