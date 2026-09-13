// Provider abstraction: resolve broker/import symbols first, then Yahoo Finance and fallbacks.
const yahoo = require('./yahooService');
const { candidates: symbolCandidates, canonical } = require('./symbolResolver');
const PROVIDER = process.env.DATA_PROVIDER || 'yahoo';
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || null;
const HTTP_TIMEOUT_MS = 8000;

function safeNumber(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
async function httpGetJson(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), HTTP_TIMEOUT_MS);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'stock-tracking-app/1.0' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}
function stooqCandidates(symbol) {
  const s = String(symbol || '').trim().toLowerCase(); if (!s || s.includes('^')) return [];
  const direct = s.includes('.') ? [s] : [`${s}.us`];
  if (s.endsWith('.de')) direct.push(`${s.slice(0, -3)}.de`); if (s.endsWith('.f')) direct.push(`${s.slice(0, -2)}.de`); if (s.endsWith('.l')) direct.push(`${s.slice(0, -2)}.uk`);
  return [...new Set(direct)];
}
function formatDate(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
function rangeDays(range) { return { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825 }[range] || 365; }

async function fetchDirectYahooQuote(symbol) {
  try {
    const json = await httpGetJson(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`);
    const q = json?.quoteResponse?.result?.[0]; if (!q) return null;
    const data = {
      symbol, price: safeNumber(q.regularMarketPrice), previousClose: safeNumber(q.regularMarketPreviousClose ?? q.previousClose),
      change: safeNumber(q.regularMarketChange), changePercent: safeNumber(q.regularMarketChangePercent),
      dayHigh: safeNumber(q.regularMarketDayHigh), dayLow: safeNumber(q.regularMarketDayLow), volume: safeNumber(q.regularMarketVolume),
      avgVolume: safeNumber(q.averageDailyVolume3Month), currency: q.currency || (/\\.(DE|F)$/i.test(symbol) ? 'EUR' : 'USD'),
      timestamp: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      exchangeName: q.fullExchangeName || q.exchange || null, marketState: q.marketState || null,
      marketCap: safeNumber(q.marketCap), peRatio: safeNumber(q.trailingPE), forwardPe: safeNumber(q.forwardPE),
      pegRatio: safeNumber(q.pegRatio), pbRatio: safeNumber(q.priceToBook), psRatio: safeNumber(q.priceToSalesTrailing12Months),
      eps: safeNumber(q.epsTrailingTwelveMonths), forwardEps: safeNumber(q.epsForward),
      yearHigh: safeNumber(q.fiftyTwoWeekHigh), yearLow: safeNumber(q.fiftyTwoWeekLow),
    };
    return data.price != null ? data : null;
  } catch (err) { console.error(`[yahoo-direct] quote error for ${symbol}:`, err.message); return null; }
}

async function fetchDirectYahooHistory(symbol, days = 365, interval = '1d') {
  const end = Math.floor(Date.now() / 1000), start = Math.floor((Date.now() - days * 86400000) / 1000);
  try {
    const json = await httpGetJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=${encodeURIComponent(interval)}&events=div%2Csplits&includeAdjustedClose=true`);
    const result = json?.chart?.result?.[0]; if (!result) return [];
    const ts = result.timestamp || [], q = result.indicators?.quote?.[0] || {}, adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    return ts.map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), open: safeNumber(q.open?.[i]), high: safeNumber(q.high?.[i]), low: safeNumber(q.low?.[i]), close: safeNumber(q.close?.[i]), volume: safeNumber(q.volume?.[i]), adjClose: safeNumber(adj[i]) })).filter(r => r.close !== null);
  } catch (err) { console.error(`[yahoo-direct] history error for ${symbol}:`, err.message); return []; }
}
async function fetchStooqHistory(symbol, days = 365) {
  const end = new Date(), start = new Date(); start.setDate(end.getDate() - days);
  for (const ss of stooqCandidates(symbol)) { try { const p = new URLSearchParams({ s: ss, i: 'd', d1: formatDate(start), d2: formatDate(end) }); const r = await fetch(`https://stooq.com/q/d/l/?${p}`, { headers: { 'User-Agent': 'stock-tracking-app/1.0' } }); if (!r.ok) continue; const lines = (await r.text()).trim().split(/\r?\n/); if (lines.length < 2) continue; const rows = lines.slice(1).map(x => { const [date, open, high, low, close, volume] = x.split(','); return { date, open: safeNumber(open), high: safeNumber(high), low: safeNumber(low), close: safeNumber(close), volume: safeNumber(volume), adjClose: safeNumber(close) }; }).filter(x => x.date && x.close != null); if (rows.length) return rows; } catch (e) { console.error(`[stooq] ${symbol}:`, e.message); } }
  return [];
}
function avEnabled() { return !!AV_KEY; }
async function fetchAlphaVantageHistory(symbol, days = 365) {
  const json = await httpGetJson(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(AV_KEY)}`); const series = json?.['Time Series (Daily)']; if (!series) return [];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); const cut = cutoff.toISOString().slice(0, 10);
  return Object.entries(series).sort((a,b) => a[0].localeCompare(b[0])).map(([date,d]) => ({ date, open:safeNumber(d['1. open']), high:safeNumber(d['2. high']), low:safeNumber(d['3. low']), close:safeNumber(d['4. close']), adjClose:safeNumber(d['5. adjusted close']), volume:safeNumber(d['6. volume']) })).filter(x => x.close != null && x.date >= cut);
}
async function firstSuccessful(symbol, fn) { for (const candidate of symbolCandidates(symbol)) { try { const result = await fn(candidate); if (result) return { candidate, result }; } catch (err) { console.error(`[provider] ${candidate}:`, err.message); } } return null; }

async function fetchQuote(symbol) {
  const yahooQuote = await firstSuccessful(symbol, candidate => yahoo.fetchQuote(candidate));
  const directQuote = await firstSuccessful(symbol, candidate => fetchDirectYahooQuote(candidate));
  const base = directQuote?.result || yahooQuote?.result;
  if (base?.price != null) return { ...base, symbol, dataSymbol: directQuote?.candidate || yahooQuote?.candidate };
  const direct = await firstSuccessful(symbol, candidate => fetchDirectYahooHistory(candidate, 7, '1d').then(rows => rows.length ? rows : null));
  if (direct?.result?.length) { const rows = direct.result, last = rows[rows.length-1], prev = rows[rows.length-2], change = prev?.close != null ? last.close-prev.close : 0; return { symbol, dataSymbol:direct.candidate, price:last.close, previousClose:prev?.close ?? last.close, change, changePercent:prev?.close ? change/prev.close*100 : 0, dayHigh:last.high, dayLow:last.low, volume:last.volume, currency:/\\.(DE|F)$/i.test(direct.candidate)?'EUR':'USD', timestamp:`${last.date}T00:00:00.000Z`, exchangeName:/\\.DE$/i.test(direct.candidate)?'XETRA':null, marketState:null }; }
  if (avEnabled()) for (const candidate of symbolCandidates(symbol)) { try { const q=await httpGetJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(candidate)}&apikey=${encodeURIComponent(AV_KEY)}`), g=q?.['Global Quote']; if (g?.['05. price']) return { symbol,dataSymbol:candidate,price:safeNumber(g['05. price']),change:safeNumber(g['09. change']),changePercent:safeNumber(String(g['10. change percent']||'').replace('%','')),previousClose:safeNumber(g['08. previous close']),open:safeNumber(g['02. open']),dayHigh:safeNumber(g['03. high']),dayLow:safeNumber(g['04. low']),volume:safeNumber(g['06. volume']),currency:/\\.(DE|F)$/i.test(candidate)?'EUR':'USD',timestamp:new Date().toISOString() }; } catch(e) { console.error(`[provider] AV quote ${candidate}:`,e.message); } }
  for (const candidate of symbolCandidates(symbol)) { const h=await fetchStooqHistory(candidate,14); if(h.length){const last=h[h.length-1],prev=h[h.length-2],change=prev?.close!=null?last.close-prev.close:0; return {symbol,dataSymbol:candidate,price:last.close,previousClose:prev?.close??last.close,change,changePercent:prev?.close?change/prev.close*100:0,currency:/\\.(DE|F)$/i.test(candidate)?'EUR':'USD',timestamp:last.date};} }
  return null;
}

async function fetchFundamentals(symbol) {
  const live = await firstSuccessful(symbol, candidate => yahoo.fetchFundamentals(candidate));
  const quote = await fetchQuote(symbol);
  if (!live?.result && !quote) return null;
  const f = live?.result || {};
  return {
    ...f, symbol, dataSymbol: live?.candidate || quote?.dataSymbol || canonical(symbol),
    peRatio: f.peRatio ?? quote?.peRatio ?? null, forwardPe: f.forwardPe ?? quote?.forwardPe ?? null,
    pegRatio: f.pegRatio ?? quote?.pegRatio ?? null, pbRatio: f.pbRatio ?? quote?.pbRatio ?? null, psRatio: f.psRatio ?? quote?.psRatio ?? null,
    eps: f.eps ?? quote?.eps ?? null, forwardEps: f.forwardEps ?? quote?.forwardEps ?? null,
    marketCap: f.marketCap ?? quote?.marketCap ?? null, fiftyTwoWeekHigh: f.fiftyTwoWeekHigh ?? quote?.yearHigh ?? null, fiftyTwoWeekLow: f.fiftyTwoWeekLow ?? quote?.yearLow ?? null,
    lastUpdated: f.lastUpdated || quote?.timestamp || new Date().toISOString(),
  };
}
async function fetchNews(symbol) { const live=await firstSuccessful(symbol,candidate=>yahoo.fetchNews(candidate)); return live?.result || {all:[],company:[],geopolitics:[]}; }
async function fetchCalendar(symbol) { const live=await firstSuccessful(symbol,candidate=>yahoo.fetchCalendar(candidate)); return live?.result || {symbol,events:[],fetchedAt:new Date().toISOString()}; }
async function searchSymbol(query) { return yahoo.searchSymbol(query); }
function clearCache() { yahoo.clearCache(); }
async function fetchHistory(symbol, range='6mo', interval='1d', days) {
  const fallbackDays=days||rangeDays(range); const primary=await firstSuccessful(symbol,candidate=>yahoo.fetchHistory(candidate,range,interval).then(rows=>rows?.length?rows:null)); if(primary?.result)return primary.result;
  const direct=await firstSuccessful(symbol,candidate=>fetchDirectYahooHistory(candidate,fallbackDays,interval).then(rows=>rows.length?rows:null)); if(direct?.result)return direct.result;
  if(avEnabled()) for(const candidate of symbolCandidates(symbol)){try{const r=await fetchAlphaVantageHistory(candidate,fallbackDays);if(r.length)return r;}catch(e){console.error(`[provider] AV history ${candidate}:`,e.message);}}
  for(const candidate of symbolCandidates(symbol)){const r=await fetchStooqHistory(candidate,fallbackDays);if(r.length)return r;} return [];
}
module.exports={name:PROVIDER, fallbacks:{alphaVantage:avEnabled(),yahooDirect:true,stooq:true},fetchQuote,fetchFundamentals,fetchNews,fetchCalendar,fetchHistory,searchSymbol,clearCache,_internals:{stooqCandidates,safeNumber,rangeDays,symbolCandidates,canonical,fetchDirectYahooQuote,fetchDirectYahooHistory}};
