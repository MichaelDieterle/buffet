// History endpoint deliberately uses the live provider for requested windows so
// changing the chart period actually changes the returned data. Database history
// remains useful for other persisted workflows, but it must not cap live charts.
const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const schemas = require('../middleware/schemas');
const router = express.Router();
const { Stock, PriceHistory } = require('../models');
const { Sequelize } = require('sequelize');
const provider = require('../services/provider');
const refresh = require('../services/refreshJob');
const indicator = require('../services/indicator');

const yahooLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: true, message: { error: 'Too many requests, please try again later.' } });
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many search requests, please try again later.' } });

router.get('/_admin/refresh-status', async (req, res) => res.status(404).json({ error: 'Not found' }));
router.post('/_admin/refresh', async (req, res) => res.status(404).json({ error: 'Not found' }));

router.get('/', validate({ query: schemas.listStocks }), async (req, res) => {
  try {
    const { sector, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    const safeLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
    const stocks = await Stock.findAll({ where, limit: safeLimit, offset: safeOffset, order: [['symbol', 'ASC']] });
    res.json(stocks);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/search/:query', searchLimiter, validate({ params: schemas.searchStocks }), async (req, res) => {
  try { res.json(await provider.searchSymbol(req.params.query)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/', validate({ body: schemas.createStock }), async (req, res) => {
  try {
    const { symbol, name, sector, industry, currency, marketCap, fetchOnCreate = true } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: 'symbol and name are required' });
    const upper = symbol.toUpperCase();
    const [stock, created] = await Stock.findOrCreate({ where: { symbol: upper }, defaults: { symbol: upper, name, sector, industry, currency, marketCap } });
    if (!created && (name || sector || industry || marketCap)) await stock.update({ name: name ?? stock.name, sector: sector ?? stock.sector, industry: industry ?? stock.industry, marketCap: marketCap ?? stock.marketCap });
    if (created && fetchOnCreate) refresh.refreshOneStock(stock).catch(err => console.error('[create] initial fetch failed:', err.message));
    res.status(created ? 201 : 200).json(stock);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:symbol', validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } }); if (!stock) return res.status(404).json({ error: 'Stock not found' }); res.json(stock); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:symbol/history', validate({ params: schemas.stockSymbol, query: schemas.history }), async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { start, end, limit = 500, days } = req.query;
    const safeDays = days && parseInt(days, 10) ? Math.min(3650, Math.max(1, parseInt(days, 10))) : null;

    // Explicit chart windows are always fetched live. This fixes the old
    // behaviour where a persisted 100-row result could make 1M/3M/6M/1Y look identical.
    if (safeDays) {
      const range = safeDays <= 31 ? '1mo' : safeDays <= 93 ? '3mo' : safeDays <= 186 ? '6mo' : safeDays <= 370 ? '1y' : safeDays <= 750 ? '2y' : '5y';
      const live = await provider.fetchHistory(symbol, range, '1d', safeDays);
      if (live?.length) return res.json(live);
    }

    const where = {};
    if (start) where.date = { [Sequelize.Op.gte]: new Date(start) };
    if (end) where.date = { ...(where.date || {}), [Sequelize.Op.lte]: new Date(end) };
    let history = [];
    try {
      const stock = await Stock.findOne({ where: { symbol } });
      if (stock) history = await PriceHistory.findAll({ where: { ...where, stockId: stock.id }, order: [['date', 'DESC']], limit: Math.min(2000, Math.max(1, parseInt(limit, 10) || 500)) });
    } catch (dbErr) { console.warn(`[stocks] DB unavailable for ${symbol} history:`, dbErr.message); }
    if (!history.length) {
      const live = await provider.fetchHistory(symbol, undefined, '1d', 365);
      if (live?.length) return res.json(live);
      return res.status(404).json({ error: 'No price history available' });
    }
    res.json(history);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:symbol/quote', yahooLimiter, validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { const data = await provider.fetchQuote(req.params.symbol.toUpperCase()); if (!data) return res.status(404).json({ error: 'No data returned from provider' }); res.json(data); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.get('/:symbol/fundamentals', yahooLimiter, validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { const data = await provider.fetchFundamentals(req.params.symbol.toUpperCase()); if (!data) return res.status(404).json({ error: 'No fundamentals data returned' }); res.json(data); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.get('/:symbol/news', yahooLimiter, validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { res.json(await provider.fetchNews(req.params.symbol.toUpperCase())); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.get('/:symbol/calendar', yahooLimiter, validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { res.json(await provider.fetchCalendar(req.params.symbol.toUpperCase())); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.get('/:symbol/yahoo-history', yahooLimiter, validate({ params: schemas.stockSymbol, query: schemas.yahooHistory }), async (req, res) => {
  try { const { range = '6mo', interval = '1d' } = req.query; res.json(await provider.fetchHistory(req.params.symbol.toUpperCase(), range, interval)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.get('/:symbol/indicators', yahooLimiter, validate({ params: schemas.stockSymbol }), async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase(); const stock = await Stock.findOne({ where: { symbol } });
    let priceHistory = stock ? await PriceHistory.findAll({ where: { stockId: stock.id }, order: [['date', 'ASC']], limit: 200 }) : [];
    if (priceHistory.length < 50) { const providerHistory = await provider.fetchHistory(symbol, '1y', '1d', 200); if (providerHistory.length > priceHistory.length) priceHistory = providerHistory; }
    if (!priceHistory.length) return res.status(404).json({ error: 'No price history available' });
    const plain = priceHistory.map(ph => typeof ph.get === 'function' ? ph.get({ plain: true }) : ph); const closes = plain.map(p => parseFloat(p.close)).filter(Number.isFinite);
    if (!closes.length) return res.status(404).json({ error: 'No valid closing prices available' });
    const ind = indicator.computeIndicators(closes); const latest = {}; const lastIdx = closes.length - 1;
    for (const key in ind) latest[key] = Array.isArray(ind[key]) ? (ind[key][lastIdx] ?? null) : ind[key];
    res.json({ symbol, indicators: latest });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.post('/:symbol/refresh', validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } }); if (!stock) return res.status(404).json({ error: 'Stock not found' }); res.json(await refresh.refreshOneStock(stock)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
router.delete('/:symbol', validate({ params: schemas.stockSymbol }), async (req, res) => {
  try { const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } }); if (!stock) return res.status(404).json({ error: 'Stock not found' }); await stock.destroy(); res.json({ removed: req.params.symbol.toUpperCase() }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
module.exports = router;
