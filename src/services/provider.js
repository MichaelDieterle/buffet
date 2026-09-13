// Provider abstraction: Yahoo Finance first, then direct Yahoo chart and exchange-aware fallbacks.
const yahoo = require('./yahooService');
const PROVIDER = process.env.DATA_PROVIDER || 'yahoo';
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || null;
const HTTP_TIMEOUT_MS = 8000;

function safeNumber(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

async function httpGetJson(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), HTTP_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'stock-tracking-app/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function stooqCandidates(symbol) {
  const s = String(symbol || '').trim().toLowerCase();
  if (!s || s.includes('^')) return [];
  const direct = s.includes('.') ? [s] : [`${s}.us`];
  if (s.endsWith('.de')) direct.push(`${s.slice(0, -3)}.de`);
  if (s.endsWith('.l')) direct.push(`${s.slice(0, -2)}.uk`);
  return [...new Set(direct)];
}

function formatDate(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }

function rangeDays(range) {
  return { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825 }[range] || 365;
}

async function fetchDirectYahooHistory(symbol, days = 365, interval = '1d') {
  const end = Math.floor(Date.now() / 1000);
  const start = Math.floor((Date.now() - days * 86400000) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=${encodeURIComponent(interval)}&events=div%2Csplits&includeAdjustedClose=true`;
  try {
    const json = await httpGetJson(url);
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    return ts.map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: safeNumber(q.open?.[i]), high: safeNumber(q.high?.[i]), low: safeNumber(q.low?.[i]),
      close: safeNumber(q.close?.[i]), volume: safeNumber(q.volume?.[i]), adjClose: safeNumber(adj[i]),
    })).filter(r => r.close !== null);
  } catch (err) {
    console.error(`[yahoo-direct] history error for ${symbol}:`, err.message);
    return [];
  }
}

async function fetchStooqHistory(symbol, days = 365) {
  const end = new Date(), start = new Date();
  start.setDate(end.getDate() - days);
  for (const ss of stooqCandidates(symbol)) {
    try {
      const p = new URLSearchParams({ s: ss, i: 'd', d1: formatDate(start), d2: formatDate(end) });
      const r = await fetch(`https://stooq.com/q/d/l/?${p}`, { headers: { 'User-Agent': 'stock-tracking-app/1.0' } });
      if (!r.ok) continue;
      const lines = (await r.text()).trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      const rows = lines.slice(1).map(x => {
        const [date, open, high, low, close, volume] = x.split(',');
        return { date, open: safeNumber(open), high: safeNumber(high), low: safeNumber(low), close: safeNumber(close), volume: safeNumber(volume), adjClose: safeNumber(close) };
      }).filter(x => x.date && x.close != null);
      if (rows.length) return rows;
    } catch (e) { console.error(`[stooq] ${symbol}:`, e.message); }
  }
  return [];
}

function avEnabled() { return !!AV_KEY; }

async function fetchAlphaVantageHistory(symbol, days = 365) {
  const json = await httpGetJson(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(AV_KEY)}`);
  const series = json?.['Time Series (Daily)'];
  if (!series) return [];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const cut = cutoff.toISOString().slice(0, 10);
  return Object.entries(series).sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({
    date, open: safeNumber(d['1. open']), high: safeNumber(d['2. high']), low: safeNumber(d['3. low']),
    close: safeNumber(d['4. close']), adjClose: safeNumber(d['5. adjusted close']), volume: safeNumber(d['6. volume'])
  })).filter(x => x.close != null && x.date >= cut);
}

async function fetchQuote(symbol) {
  const primary = await yahoo.fetchQuote(symbol);
  if (primary?.price != null) return primary;

  // yahoo-finance2 can fail for individual exchange symbols while Yahoo's chart
  // endpoint still serves valid market data. Use it before slower fallbacks.
  const direct = await fetchDirectYahooHistory(symbol, 7, '1d');
  if (direct.length) {
    const last = direct[direct.length - 1];
    const prev = direct[direct.length - 2];
    const change = prev?.close != null ? last.close - prev.close : 0;
    return {
      symbol, price: last.close, previousClose: prev?.close ?? last.close, change,
      changePercent: prev?.close ? change / prev.close * 100 : 0,
      dayHigh: last.high, dayLow: last.low, volume: last.volume,
      currency: symbol.toUpperCase().endsWith('.DE') ? 'EUR' : 'USD',
      timestamp: `${last.date}T00:00:00.000Z`, exchangeName: symbol.toUpperCase().endsWith('.DE') ? 'XETRA' : null,
      marketState: null,
    };
  }

  if (avEnabled()) try {
    const q = await httpGetJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(AV_KEY)}`);
    const g = q?.['Global Quote'];
    if (g?.['05. price']) return {
      symbol, price: safeNumber(g['05. price']), change: safeNumber(g['09. change']),
      changePercent: safeNumber(String(g['10. change percent'] || '').replace('%', '')),
      previousClose: safeNumber(g['08. previous close']), open: safeNumber(g['02. open']),
      dayHigh: safeNumber(g['03. high']), dayLow: safeNumber(g['04. low']), volume: safeNumber(g['06. volume']),
      currency: symbol.toUpperCase().endsWith('.DE') ? 'EUR' : 'USD', timestamp: new Date().toISOString()
    };
  } catch (e) { console.error(`[provider] AV quote ${symbol}:`, e.message); }

  const h = await fetchStooqHistory(symbol, 14);
  if (h.length) {
    const last = h[h.length - 1], prev = h[h.length - 2];
    const change = prev?.close != null ? last.close - prev.close : 0;
    return { symbol, price: last.close, previousClose: prev?.close ?? last.close, change, changePercent: prev?.close ? change / prev.close * 100 : 0, currency: symbol.toUpperCase().endsWith('.DE') ? 'EUR' : 'USD', timestamp: last.date };
  }
  return null;
}

async function fetchFundamentals(symbol) { return yahoo.fetchFundamentals(symbol); }
async function fetchNews(symbol) { return yahoo.fetchNews(symbol); }
async function fetchCalendar(symbol) { return yahoo.fetchCalendar(symbol); }
async function searchSymbol(query) { return yahoo.searchSymbol(query); }
function clearCache() { yahoo.clearCache(); }

async function fetchHistory(symbol, range = '6mo', interval = '1d', days) {
  const fallbackDays = days || rangeDays(range);
  const primary = await yahoo.fetchHistory(symbol, range, interval);
  if (primary?.length) return primary;
  const direct = await fetchDirectYahooHistory(symbol, fallbackDays, interval);
  if (direct.length) return direct;
  if (avEnabled()) try {
    const r = await fetchAlphaVantageHistory(symbol, fallbackDays);
    if (r.length) return r;
  } catch (e) { console.error(`[provider] AV history ${symbol}:`, e.message); }
  return fetchStooqHistory(symbol, fallbackDays);
}

module.exports = {
  name: PROVIDER,
  fallbacks: { alphaVantage: avEnabled(), yahooDirect: true, stooq: true },
  fetchQuote, fetchFundamentals, fetchNews, fetchCalendar, fetchHistory, searchSymbol, clearCache,
  _internals: { stooqCandidates, safeNumber, rangeDays }
};
