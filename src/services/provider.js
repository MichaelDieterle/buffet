// Provider abstraction: routes all market data requests through a pluggable
// provider. Primary source is Yahoo Finance (yahooService). When a provider
// returns no data (e.g. Yahoo is down or rate-limited), optional fallbacks are
// used so the app always delivers data:
//
//   1. Alpha Vantage (free, requires ALPHA_VANTAGE_API_KEY; ~25 req/day free)
//   2. Stooq (free daily CSV, no key, but can be blocked in some regions)
//
// The active provider name is reported via GET /api/stocks/_admin/refresh-status
// (stats.provider) and can be influenced with the DATA_PROVIDER env var.
const yahoo = require('./yahooService');

const PROVIDER = process.env.DATA_PROVIDER || 'yahoo';
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || null;
const HTTP_TIMEOUT_MS = 8000;

function httpGetJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'stock-tracking-app/1.0' },
  }).then(async (res) => {
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }).catch((err) => {
    clearTimeout(timer);
    throw err;
  });
}

function safeNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Stooq fallback (free daily OHLCV CSV, no API key required) ──────────────
function toStooqSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;
  let s = symbol.trim().toLowerCase();
  if (!s || s.includes('^')) return null; // skip indices/aggregates
  if (s.includes('.')) {
    // Yahoo uses SAP.DE, AIR.PA, BP.L … Stooq uses sap.de, air.pa, bp.uk
    if (s.endsWith('.l')) return s.slice(0, -2) + '.uk';
    return s;
  }
  return `${s}.us`;
}

function formatStooqDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchStooqHistory(symbol, days = 365) {
  const stooqSymbol = toStooqSymbol(symbol);
  if (!stooqSymbol) return [];
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const params = new URLSearchParams({
    s: stooqSymbol,
    i: 'd',
    d1: formatStooqDate(start),
    d2: formatStooqDate(end),
  });
  const url = `https://stooq.com/q/d/l/?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'stock-tracking-app/1.0' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const rows = [];
    for (const line of lines.slice(1)) {
      const [date, open, high, low, close, volume] = line.split(',');
      if (!date) continue;
      rows.push({
        date,
        open: safeNumber(open),
        high: safeNumber(high),
        low: safeNumber(low),
        close: safeNumber(close),
        volume: safeNumber(volume),
        adjClose: safeNumber(close),
      });
    }
    return rows.filter(r => r.close != null);
  } catch (err) {
    console.error(`[stooq] history error for ${symbol}:`, err.message);
    return [];
  }
}

// ── Alpha Vantage fallback (optional, needs ALPHA_VANTAGE_API_KEY) ───────────
function avEnabled() { return !!AV_KEY; }

function avSymbol(symbol) {
  return encodeURIComponent(symbol);
}

async function fetchAlphaVantageQuote(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol(symbol)}&apikey=${encodeURIComponent(AV_KEY)}`;
  const json = await httpGetJson(url);
  const gq = json?.['Global Quote'];
  if (!gq) return null;
  const price = safeNumber(gq['05. price']);
  const change = safeNumber(gq['09. change']);
  const changePercent = safeNumber(String(gq['10. change percent'] || '').replace('%', ''));
  const previousClose = safeNumber(gq['08. previous close']);
  const open = safeNumber(gq['02. open']);
  const dayHigh = safeNumber(gq['03. high']);
  const dayLow = safeNumber(gq['04. low']);
  const volume = safeNumber(gq['06. volume']);
  return {
    symbol,
    price,
    change,
    changePercent,
    previousClose,
    open,
    dayHigh,
    dayLow,
    volume,
    currency: null,
    timestamp: new Date().toISOString(),
  };
}

async function fetchAlphaVantageHistory(symbol, days = 365) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${avSymbol(symbol)}&outputsize=compact&apikey=${encodeURIComponent(AV_KEY)}`;
  const json = await httpGetJson(url);
  const series = json?.['Time Series (Daily)'];
  if (!series) return [];
  const rows = Object.entries(series)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, d]) => ({
      date,
      open: safeNumber(d['1. open']),
      high: safeNumber(d['2. high']),
      low: safeNumber(d['3. low']),
      close: safeNumber(d['4. close']),
      adjClose: safeNumber(d['5. adjusted close']),
      volume: safeNumber(d['6. volume']),
    }))
    .filter(r => r.close != null);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Provider facade ─────────────────────────────────────────────────────────
async function fetchQuote(symbol) {
  const primary = await yahoo.fetchQuote(symbol);
  if (primary) return primary;
  if (avEnabled()) {
    try {
      const q = await fetchAlphaVantageQuote(symbol);
      if (q) {
        console.log(`[provider] quote fallback (Alpha Vantage) for ${symbol}`);
        return q;
      }
    } catch (err) {
      console.error(`[provider] Alpha Vantage quote error for ${symbol}:`, err.message);
    }
  }
  return null;
}

async function fetchFundamentals(symbol) {
  return yahoo.fetchFundamentals(symbol);
}

async function fetchNews(symbol) {
  return yahoo.fetchNews(symbol);
}

async function fetchCalendar(symbol) {
  return yahoo.fetchCalendar(symbol);
}

async function fetchHistory(symbol, range = '6mo', interval = '1d', days) {
  const result = await yahoo.fetchHistory(symbol, range, interval);
  if (result && result.length > 0) return result;
  const fallbackDays = days || 365;

  if (avEnabled()) {
    try {
      const rows = await fetchAlphaVantageHistory(symbol, fallbackDays);
      if (rows.length > 0) {
        console.log(`[provider] history fallback (Alpha Vantage) for ${symbol}: ${rows.length} rows`);
        return rows;
      }
    } catch (err) {
      console.error(`[provider] Alpha Vantage history error for ${symbol}:`, err.message);
    }
  }

  const stooq = await fetchStooqHistory(symbol, fallbackDays);
  if (stooq.length > 0) {
    console.log(`[provider] history fallback (Stooq) for ${symbol}: ${stooq.length} rows`);
  }
  return stooq;
}

async function searchSymbol(query) {
  return yahoo.searchSymbol(query);
}

function clearCache() {
  yahoo.clearCache();
}

module.exports = {
  name: PROVIDER,
  fallbacks: {
    alphaVantage: avEnabled(),
    stooq: true,
  },
  fetchQuote,
  fetchFundamentals,
  fetchNews,
  fetchCalendar,
  fetchHistory,
  searchSymbol,
  clearCache,
  _internals: { toStooqSymbol, safeNumber },
};
