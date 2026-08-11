const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const provider = require('../services/provider');
const indicator = require('../services/indicator');
const { Stock, PriceHistory } = require('../models');

// Read-only MCP server exposing the Buffet stock tracker as Claude tools.
// Stateless per-request transport (see ./http.js) so it works on serverless.
const server = new McpServer({
  name: 'buffet-stock-tracker',
  version: '1.0.0',
  instructions:
    'Read-only access to the Buffet stock tracker (Yahoo Finance market data). ' +
    'Use search_stocks to find a company by name, then get_quote, get_fundamentals, ' +
    'get_news, get_calendar or get_price_history for details. All symbols are upper-case tickers.',
});

function text(content) {
  return { content: [{ type: 'text', text: content }] };
}

async function latestIndicators(symbol) {
  let rows = [];
  try {
    const stock = await Stock.findOne({ where: { symbol } });
    if (stock) {
      rows = await PriceHistory.findAll({
        where: { stockId: stock.id },
        order: [['date', 'ASC']],
        limit: 200,
      });
    }
  } catch (err) {
    // DB unavailable - fall back to provider below
  }
  if (rows.length === 0) {
    const hist = await provider.fetchHistory(symbol, undefined, '1d', 200);
    rows = (hist || []).map(r => ({ close: r.close }));
  }
  if (rows.length === 0) return null;
  const closes = rows.map(r => parseFloat(r.close));
  const ind = indicator.computeIndicators(closes);
  const lastIdx = closes.length - 1;
  const latest = {};
  for (const key in ind) {
    latest[key] = Array.isArray(ind[key]) ? ind[key][lastIdx] : ind[key];
  }
  return latest;
}

server.tool(
  'search_stocks',
  'Find stocks by company name or ticker symbol. Example: search_stocks("Apple") returns AAPL.',
  { query: z.string().min(1).describe('Search term: company name or ticker symbol') },
  async ({ query }) => {
    const results = await provider.searchSymbol(query);
    return text(JSON.stringify(results, null, 2));
  }
);

server.tool(
  'list_tracked_stocks',
  'List all stocks currently tracked in the dashboard (symbol, name, sector).',
  {},
  async () => {
    let rows = [];
    try {
      rows = await Stock.findAll({ where: { isTracked: true } });
    } catch (err) {
      return text(JSON.stringify({ error: 'Database unavailable', stocks: [] }));
    }
    const stocks = rows.map(s => ({
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      industry: s.industry,
      currency: s.currency,
      marketCap: s.marketCap,
      lastSyncedAt: s.lastSyncedAt,
    }));
    return text(JSON.stringify(stocks, null, 2));
  }
);

server.tool(
  'get_quote',
  'Get the current live quote for a stock (price, change, day range, market cap).',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const q = await provider.fetchQuote(sym);
    if (!q) return text(JSON.stringify({ error: `No quote data for ${sym}` }));
    return text(JSON.stringify(q, null, 2));
  }
);

server.tool(
  'get_fundamentals',
  'Get fundamental data for a stock (valuation, dividends, margins, cash flow, analyst targets, business summary).',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const f = await provider.fetchFundamentals(sym);
    if (!f) return text(JSON.stringify({ error: `No fundamentals for ${sym}` }));
    return text(JSON.stringify(f, null, 2));
  }
);

server.tool(
  'get_news',
  'Get recent news for a stock, split into company and geopolitical items.',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const n = await provider.fetchNews(sym);
    const summary = {
      company: (n.company || []).map(x => ({ title: x.title, publisher: x.publisher, publishedAt: x.publishedAt, link: x.link })),
      geopolitics: (n.geopolitics || []).map(x => ({ title: x.title, publisher: x.publisher, publishedAt: x.publishedAt, link: x.link })),
    };
    return text(JSON.stringify(summary, null, 2));
  }
);

server.tool(
  'get_calendar',
  'Get upcoming events for a stock (earnings, dividends, splits).',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const c = await provider.fetchCalendar(sym);
    return text(JSON.stringify(c, null, 2));
  }
);

server.tool(
  'get_price_history',
  'Get historical daily closes for a stock. Use for analysis or simple charts.',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL'), days: z.number().int().min(5).max(730).optional().describe('Number of days of history (default 90)') },
  async ({ symbol, days }) => {
    const sym = symbol.toUpperCase();
    const hist = await provider.fetchHistory(sym, undefined, '1d', days || 90);
    if (!hist || hist.length === 0) return text(JSON.stringify({ error: `No price history for ${sym}` }));
    return text(JSON.stringify(hist, null, 2));
  }
);

server.tool(
  'get_indicators',
  'Get technical indicators for a stock (SMA, EMA, RSI, MACD).',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const ind = await latestIndicators(sym);
    if (!ind) return text(JSON.stringify({ error: `No price history for ${sym}` }));
    return text(JSON.stringify({ symbol: sym, indicators: ind }, null, 2));
  }
);

server.tool(
  'get_stock_overview',
  'Get a compact overview for a stock: live quote plus key fundamentals in one call.',
  { symbol: z.string().min(1).describe('Stock ticker, e.g. AAPL') },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase();
    const [q, f, c] = await Promise.all([
      provider.fetchQuote(sym).catch(() => null),
      provider.fetchFundamentals(sym).catch(() => null),
      provider.fetchCalendar(sym).catch(() => null),
    ]);
    if (!q && !f) return text(JSON.stringify({ error: `No data for ${sym}` }));
    return text(JSON.stringify({ symbol: sym, quote: q, fundamentals: f, calendar: c }, null, 2));
  }
);

module.exports = server;
