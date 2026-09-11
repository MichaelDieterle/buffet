const NodeCache = require('node-cache');
const { Stock, Earning, News, Fundamental } = require('../models');
const provider = require('./provider');

const cache = new NodeCache({ stdTTL: 60 * 5 });

function clamp(v, lo, hi) {
  if (v == null || !Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

function scoreFromRatio(value, goodIsLow, neutral = 0.5) {
  // Compress a ratio to 0..1, neutral = 1.0, better values at 1.
  let n = value;
  if (goodIsLow) n = value === 0 ? 1 : 1 / Math.abs(value);
  const s = 1 / (1 + Math.exp(-(n - neutral) * 2));
  return clamp(s * 100, 0, 100);
}

// ── Fundamental Score ────────────────────────────────────────────────────────
// Composite 0..100 from the latest Fundamental snapshot. Sub-scores are
// computed against reasonable absolute thresholds (not relative to sector peers),
// so a standalone score is available even with a single-stock watchlist.
function scoreFundamental(f) {
  const valuation = [];
  if (f.peRatio != null) valuation.push(scoreFromRatio(f.peRatio, true, 0.5));
  if (f.forwardPe != null) valuation.push(scoreFromRatio(f.forwardPe, true, 0.5));
  if (f.pegRatio != null) valuation.push(scoreFromRatio(f.pegRatio, true, 0.5));
  if (f.pbRatio != null) valuation.push(scoreFromRatio(f.pbRatio, true, 1.5));
  if (f.psRatio != null) valuation.push(scoreFromRatio(f.psRatio, true, 2));

  const profitability = [];
  if (f.profitMargins != null) profitability.push(clamp((f.profitMargins + 0.5) * 100, 0, 100));
  if (f.operatingMargins != null) profitability.push(clamp((f.operatingMargins + 0.5) * 100, 0, 100));
  if (f.grossMargins != null) profitability.push(clamp((f.grossMargins + 0.5) * 100, 0, 100));
  if (f.roa != null) profitability.push(clamp((f.roa + 0.25) * 200, 0, 100));
  if (f.roc != null) profitability.push(clamp((f.roc + 0.3) * 180, 0, 100));

  const growth = [];
  if (f.earningsGrowth != null) growth.push(clamp((f.earningsGrowth + 0.5) * 100, 0, 100));
  if (f.revenueGrowth != null) growth.push(clamp((f.revenueGrowth + 0.5) * 100, 0, 100));

  const health = [];
  if (f.currentRatio != null) health.push(scoreFromRatio(f.currentRatio, false, 1.2));
  if (f.quickRatio != null) health.push(scoreFromRatio(f.quickRatio, false, 0.9));
  if (f.debtToEquity != null) health.push(scoreFromRatio(f.debtToEquity, true, 0.5));
  if (f.totalCash != null && f.totalDebt != null) {
    if (f.totalDebt <= 0) health.push(100);
    else health.push(clamp((f.totalCash / f.totalDebt) * 100, 0, 100));
  }

  const dividend = [];
  if (f.dividendYield != null) {
    const yieldPct = f.dividendYield; // stored as fraction
    dividend.push(clamp((yieldPct / 0.04) * 100, 0, 100));
  }

  const analyst = [];
  if (f.recommendationMean != null) {
    const rec = clamp((6 - f.recommendationMean) / 4.6, 0, 1) * 100;
    analyst.push(rec);
  }
  if (f.targetMeanPrice != null && f.price != null && f.price > 0) {
    analyst.push(clamp(((f.targetMeanPrice / f.price - 1) + 0.2) * 200, 0, 100));
  }

  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const parts = {
    valuation: avg(valuation),
    profitability: avg(profitability),
    growth: avg(growth),
    health: avg(health),
    dividend: dividend.length ? avg(dividend) : null,
    analyst: avg(analyst),
  };

  const weights = [
    ['valuation', 0.25],
    ['profitability', 0.25],
    ['growth', 0.15],
    ['health', 0.15],
    ['dividend', 0.1],
    ['analyst', 0.1],
  ];
  let score = 0;
  let weightSum = 0;
  for (const [key, w] of weights) {
    if (parts[key] != null) { score += parts[key] * w; weightSum += w; }
  }
  const total = weightSum > 0 ? Math.round(score / weightSum) : null;
  return { total, parts, coverage: Math.round(weightSum * 100) };
}

// ── Performance ──────────────────────────────────────────────────────────────
function performanceFromCloses(rows) {
  if (!rows || rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const closes = sorted.map(r => Number(r.close)).filter(n => Number.isFinite(n) && n > 0);
  if (closes.length < 2) return null;

  const last = closes[closes.length - 1];
  const first = closes[0];
  const returns = { all: last / first - 1 };

  const pickPeriod = days => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const pivotIdx = sorted.findIndex(r => r.date >= cutoffStr);
    if (pivotIdx <= 0) return returns.all;
    const pivotClose = Number(sorted[pivotIdx].close);
    return pivotClose > 0 ? last / pivotClose - 1 : null;
  };
  returns.m1 = pickPeriod(30);
  returns.m3 = pickPeriod(90);
  returns.m6 = pickPeriod(180);
  returns.y1 = pickPeriod(365);

  // Max drawdown
  let peak = closes[0];
  let maxDrawdown = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = c / peak - 1;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Annualized volatility (daily std dev)
  const dailyReturns = [];
  for (let i = 1; i < closes.length; i++) dailyReturns.push(closes[i] / closes[i - 1] - 1);
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length;
  const anVol = Math.sqrt(variance) * Math.sqrt(252);

  const high = Math.max(...closes);
  const low = Math.min(...closes);

  return {
    firstDate: sorted[0].date,
    lastDate: sorted[sorted.length - 1].date,
    points: closes.length,
    price: last,
    high,
    low,
    changeAll: returns.all,
    changeM1: returns.m1,
    changeM3: returns.m3,
    changeM6: returns.m6,
    changeY1: returns.y1,
    maxDrawdown,
    volatility: anVol,
    fromHigh: last / high - 1,
    fromLow: last / low - 1,
  };
}

async function historyForStock(stock, days = 400) {
  const key = `perf:${stock.symbol}:${days}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const rows = await provider.fetchHistory(stock.symbol, '1y', '1d', days);
  cache.set(key, rows || [], 60 * 5);
  return rows || [];
}

// ── Aggregates ───────────────────────────────────────────────────────────────
async function aggregatePerformance(limit = 30) {
  const stocks = await Stock.findAll({ where: { isTracked: true }, limit });
  const rows = [];
  for (const stock of stocks) {
    try {
      const hist = await historyForStock(stock);
      const perf = performanceFromCloses(hist);
      rows.push({
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        sector: stock.sector || null,
        lastSyncedAt: stock.lastSyncedAt,
        performance: perf,
      });
    } catch (err) {
      console.error(`[analytics] performance for ${stock.symbol} failed:`, err.message);
    }
  }
  return rows.filter(r => r.performance);
}

async function aggregateEarnings() {
  const stocks = await Stock.findAll({ where: { isTracked: true } });
  const result = [];
  for (const stock of stocks) {
    const rows = await Earning.findAll({
      where: { stockId: stock.id },
      order: [['reportDate', 'ASC']],
      limit: 10,
    });
    for (const e of rows) {
      result.push({
        id: e.id,
        stockId: stock.id,
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        reportDate: e.reportDate,
        dateLow: e.dateLow,
        dateHigh: e.dateHigh,
        isEstimate: e.isEstimate,
        epsEstimate: e.epsEstimate,
        epsLow: e.epsLow,
        epsHigh: e.epsHigh,
        epsActual: e.epsActual,
        revenueEstimate: e.revenueEstimate,
        revenueLow: e.revenueLow,
        revenueHigh: e.revenueHigh,
        revenueActual: e.revenueActual,
        quarter: e.quarter,
      });
    }
  }
  // Upcoming first, then recent
  const now = new Date();
  result.sort((a, b) => {
    const ad = a.reportDate ? new Date(a.reportDate) : now;
    const bd = b.reportDate ? new Date(b.reportDate) : now;
    const af = ad >= now ? 0 : 1;
    const bf = bd >= now ? 0 : 1;
    if (af !== bf) return af - bf;
    return ad - bd;
  });
  return result;
}

async function aggregateNews(limit = 100, typeFilter) {
  const where = {};
  if (typeFilter === 'company' || typeFilter === 'geopolitics') where.type = typeFilter;
  const rows = await News.findAll({
    where,
    order: [['publishedAt', 'DESC']],
    limit,
    include: [{ model: Stock, as: 'stock', attributes: ['symbol', 'name'] }],
  });
  return rows.map(n => ({
    id: n.id,
    uuid: n.uuid,
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    publishedAt: n.publishedAt,
    type: n.type,
    thumbnail: n.thumbnail,
    relatedTickers: n.relatedTickers || [],
    stock: n.stock ? { symbol: n.stock.symbol, name: n.stock.name } : null,
  }));
}

module.exports = {
  scoreFundamental,
  aggregatePerformance,
  aggregateEarnings,
  aggregateNews,
  performanceFromCloses,
  _internals: { clamp, scoreFromRatio },
};