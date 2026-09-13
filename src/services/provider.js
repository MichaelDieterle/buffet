// Provider abstraction: routes all market data requests through a pluggable
// provider. Primary source is Yahoo Finance (yahooService). When a provider
// returns no data (e.g. Yahoo is down or rate-limited), optional fallbacks are
// used so the app always delivers data:
//
//   1. Alpha Vantage (free, requires ALPHA_VANTAGE_API_KEY; ~25 req/day free)
//   2. Stooq (free daily CSV, no key, but can be blocked in some regions)
const yahoo = require('./yahooService');
const PROVIDER = process.env.DATA_PROVIDER || 'yahoo';
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || null;
const HTTP_TIMEOUT_MS = 8000;

function httpGetJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'stock-tracking-app/1.0' } })
    .then(async (res) => { clearTimeout(timer); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .catch((err) => { clearTimeout(timer); throw err; });
}
function safeNumber(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function toStooqSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;
  let s = symbol.trim().toLowerCase();
  if (!s || s.includes('^')) return null;
  if (s.includes('.')) return s.endsWith('.l') ? s.slice(0, -2) + '.uk' : s;
  return `${s}.us`;
}
function formatStooqDate(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
async function fetchStooqHistory(symbol, days = 365) {
  const stooqSymbol = toStooqSymbol(symbol); if (!stooqSymbol) return [];
  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days);
  const params = new URLSearchParams({ s: stooqSymbol, i: 'd', d1: formatStooqDate(start), d2: formatStooqDate(end) });
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res; try { res = await fetch(`https://stooq.com/q/d/l/?${params.toString()}`, { signal: controller.signal, headers: { 'User-Agent': 'stock-tracking-app/1.0' } }); } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`); const lines = (await res.text()).trim().split(/\r?\n/); if (lines.length < 2) return [];
    return lines.slice(1).map(line => { const [date, open, high, low, close, volume] = line.split(','); return { date, open: safeNumber(open), high: safeNumber(high), low: safeNumber(low), close: safeNumber(close), volume: safeNumber(volume), adjClose: safeNumber(close) }; }).filter(r => r.date && r.close != null);
  } catch (err) { console.error(`[stooq] history error for ${symbol}:`, err.message); return []; }
}
function avEnabled() { return !!AV_KEY; }
function avSymbol(symbol) { return encodeURIComponent(symbol); }
async function fetchAlphaVantageQuote(symbol) {
  const json = await httpGetJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol(symbol)}&apikey=${encodeURIComponent(AV_KEY)}`);
  const gq = json?.['Global Quote']; if (!gq) return null;
  return { symbol, price: safeNumber(gq['05. price']), change: safeNumber(gq['09. change']), changePercent: safeNumber(String(gq['10. change percent'] || '').replace('%', '')), previousClose: safeNumber(gq['08. previous close']), open: safeNumber(gq['02. open']), dayHigh: safeNumber(gq['03. high']), dayLow: safeNumber(gq['04. low']), volume: safeNumber(gq['06. volume']), currency: null, timestamp: new Date().toISOString() };
}
async function fetchAlphaVantageHistory(symbol, days = 365) {
  const json = await httpGetJson(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${avSymbol(symbol)}&outputsize=compact&apikey=${encodeURIComponent(AV_KEY)}`);
  const series = json?.['Time Series (Daily)']; if (!series) return [];
  const rows = Object.entries(series).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([date, d]) => ({ date, open: safeNumber(d['1. open']), high: safeNumber(d['2. high']), low: safeNumber(d['3. low']), close: safeNumber(d['4. close']), adjClose: safeNumber(d['5. adjusted close']), volume: safeNumber(d['6. volume']) })).filter(r => r.close != null);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); const cutoffStr = cutoff.toISOString().slice(0, 10); return rows.filter(r => r.date >= cutoffStr);
}
async function fetchQuote(symbol) {
  const primary = await yahoo.fetchQuote(symbol); if (primary) return primary;
  if (avEnabled()) try { const q = await fetchAlphaVantageQuote(symbol); if (q) return q; } catch (err) { console.error(`[provider] Alpha Vantage quote error for ${symbol}:`, err.message); }
  return null;
}
async function fetchFundamentals(symbol) { return yahoo.fetchFundamentals(symbol); }
async function fetchNews(symbol) {
  const data = await yahoo.fetchNews(symbol);
  const wanted = String(symbol || '').trim().toUpperCase().split('.')[0];
  const relevant = article => {
    const tickers = Array.isArray(article?.relatedTickers) ? article.relatedTickers : [];
    return !tickers.length || tickers.some(t => String(t || '').trim().toUpperCase().split('.')[0] === wanted);
  };
  return { all: data.all.filter(relevant), company: data.company.filter(relevant), geopolitics: data.geopolitics.filter(relevant) };
}
async function fetchCalendar(symbol) { return yahoo.fetchCalendar(symbol); }
async function fetchHistory(symbol, range = '6mo', interval = '1d', days) {
  const result = await yahoo.fetchHistory(symbol, range, interval); if (result && result.length > 0) return result;
  const fallbackDays = days || 365;
  if (avEnabled()) try { const rows = await fetchAlphaVantageHistory(symbol, fallbackDays); if (rows.length > 0) return rows; } catch (err) { console.error(`[provider] Alpha Vantage history error for ${symbol}:`, err.message); }
  return fetchStooqHistory(symbol, fallbackDays);
}
async function searchSymbol(query) { return yahoo.searchSymbol(query); }
function clearCache() { yahoo.clearCache(); }
module.exports = { name: PROVIDER, fallbacks: { alphaVantage: avEnabled(), stooq: true }, fetchQuote, fetchFundamentals, fetchNews, fetchCalendar, fetchHistory, searchSymbol, clearCache, _internals: { toStooqSymbol, safeNumber } };
