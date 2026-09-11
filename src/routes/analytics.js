const express = require('express');
const router = express.Router();
const { Stock, Fundamental, PriceHistory } = require('../models');
const provider = require('../services/provider');
const analytics = require('../services/analytics');

// GET /api/analytics/earnings - upcoming + recent earnings across the watchlist
router.get('/earnings', async (req, res) => {
  try {
    const list = await analytics.aggregateEarnings();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/performance - return/vol/drawdown across the watchlist
router.get('/performance', async (req, res) => {
  try {
    const list = await analytics.aggregatePerformance();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/scores - fundamental scores for tracked stocks
router.get('/scores', async (req, res) => {
  try {
    const stocks = await Stock.findAll({ where: { isTracked: true } });
    const rows = [];
    for (const stock of stocks) {
      const latest = await Fundamental.findOne({
        where: { stockId: stock.id },
        order: [['snapshotDate', 'DESC']],
      });
      rows.push({
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        sector: stock.sector,
        lastSyncedAt: stock.lastSyncedAt,
        snapshotDate: latest ? latest.snapshotDate : null,
        fundamentals: latest ? latest.get({ plain: true }) : null,
        score: latest ? analytics.scoreFundamental(latest.get({ plain: true })) : null,
      });
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/compare?symbols=AAPL,MSFT - side-by-side metrics for comparison
router.get('/compare', async (req, res) => {
  try {
    const { symbols } = req.query;
    const list = String(symbols || '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const unique = [...new Set(list)];
    if (unique.length === 0) return res.json([]);

    const results = await Promise.all(
      unique.map(async symbol => {
        let stock = null;
        let priceHistory = [];
        try {
          stock = await Stock.findOne({ where: { symbol } });
          if (stock) {
            priceHistory = await PriceHistory.findAll({
              where: { stockId: stock.id },
              order: [['date', 'DESC']],
              limit: 60,
            });
          }
        } catch (err) {
          console.warn(`[analytics] compare DB for ${symbol}:`, err.message);
        }
        const [quote, fund] = await Promise.all([
          provider.fetchQuote(symbol).catch(() => null),
          provider.fetchFundamentals(symbol).catch(() => null),
        ]);
        const perf = priceHistory.length
          ? analytics.performanceFromCloses(priceHistory.map(p => ({ date: p.date, close: p.close })))
          : null;
        return { symbol, stock: stock ?? null, quote, fundamentals: fund, performance: perf };
      })
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/news - aggregated news across the watchlist
router.get('/news', async (req, res) => {
  try {
    const { type, limit } = req.query;
    const list = await analytics.aggregateNews(
      Math.min(200, Math.max(1, parseInt(limit, 10) || 100)),
      type
    );
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;