const express = require('express');
const router = express.Router();
const { Stock, PriceHistory } = require('../models');
const { Sequelize } = require('sequelize');
const yahoo = require('../services/yahooService');
const refresh = require('../services/refreshJob');
const indicator = require('../services/indicator');

// GET all stocks with optional filters
router.get('/', async (req, res) => {
  try {
    const { sector, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    const stocks = await Stock.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['symbol', 'ASC']],
    });
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET search via yahoo (proxies search before stock exists locally)
router.get('/search/:query', async (req, res) => {
  try {
    const results = await yahoo.searchSymbol(req.params.query);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create a new stock (and optionally fetch initial data)
router.post('/', async (req, res) => {
  try {
    const { symbol, name, sector, industry, currency, marketCap, fetchOnCreate = true } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: 'symbol and name are required' });
    const upper = symbol.toUpperCase();
    const [stock, created] = await Stock.findOrCreate({
      where: { symbol: upper },
      defaults: { symbol: upper, name, sector, industry, currency, marketCap },
    });
    if (!created && (name || sector || industry || marketCap)) {
      await stock.update({ name: name ?? stock.name, sector, industry, marketCap });
    }
    if (created && fetchOnCreate) {
      refresh.refreshOneStock(stock).catch(err => console.error('[create] initial fetch failed:', err.message));
    }
    res.status(created ? 201 : 200).json(stock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET stock by symbol
router.get('/:symbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(stock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET price history for a stock
router.get('/:symbol/history', async (req, res) => {
  try {
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const { start, end, limit = 100 } = req.query;
    const where = { stockId: stock.id };
    if (start) where.date = { ...(where.date || {}), [Sequelize.Op.gte]: new Date(start) };
    if (end) where.date = { ...(where.date || {}), [Sequelize.Op.lte]: new Date(end) };

    const history = await PriceHistory.findAll({
      where,
      order: [['date', 'DESC']],
      limit: parseInt(limit),
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET live quote for a stock (Yahoo)
router.get('/:symbol/quote', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await yahoo.fetchQuote(symbol);
    if (!data) return res.status(404).json({ error: 'No data returned from Yahoo' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET fundamentals (P/E, dividend, etc.)
router.get('/:symbol/fundamentals', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await yahoo.fetchFundamentals(symbol);
    if (!data) return res.status(404).json({ error: 'No fundamentals data returned' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET news (company + geopolitics, classified)
router.get('/:symbol/news', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await yahoo.fetchNews(symbol);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET calendar events (earnings, dividends, etc.)
router.get('/:symbol/calendar', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await yahoo.fetchCalendar(symbol);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET price history from Yahoo (no DB write)
router.get('/:symbol/yahoo-history', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { range = '6mo', interval = '1d' } = req.query;
    const data = await yahoo.fetchHistory(symbol, range, interval);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET technical indicators for a stock
router.get('/:symbol/indicators', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const stock = await Stock.findOne({ where: { symbol } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    // Fetch recent price history (e.g., last 100 days) for indicator calculation
    const priceHistory = await PriceHistory.findAll({
      where: { stockId: stock.id },
      order: [['date', 'ASC']],
      limit: 100,
    });

    if (priceHistory.length === 0) {
      return res.status(404).json({ error: 'No price history available' });
    }

    const plain = priceHistory.map(ph => ph.get({ plain: true }));
    const closes = plain.map(p => parseFloat(p.close));
    const ind = indicator.computeIndicators(closes);

    // Build latest values (most recent) for each indicator
    const latest = {};
    const lastIdx = closes.length - 1;
    for (const key in ind) {
      if (Array.isArray(ind[key])) {
        latest[key] = ind[key][lastIdx];
      } else {
        latest[key] = ind[key];
      }
    }

    res.json({
      symbol,
      indicators: latest,
      // optionally include full series
      // indicatorSeries: ind,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST trigger a manual refresh for one stock
router.post('/:symbol/refresh', async (req, res) => {
  try {
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    const result = await refresh.refreshOneStock(stock);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET refresh job status
router.get('/_admin/refresh-status', async (req, res) => {
  res.json(refresh.getStatus());
});

// POST trigger a global refresh
router.post('/_admin/refresh', async (req, res) => {
  const result = await refresh.refreshAll();
  res.json(result);
});

module.exports = router;
