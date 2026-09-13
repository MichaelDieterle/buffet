const express = require('express');
const validate = require('../middleware/validate');
const schemas = require('../middleware/schemas');
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

// GET /api/analytics/scores - current fundamental scores for the watchlist.
// Stored snapshots are used as a fallback, but a missing/stale snapshot is
// replaced with live provider fundamentals so the dashboard does not silently
// show an empty or weeks-old score.
router.get('/scores', async (req, res) => {
  try {
    const stocks = await Stock.findAll({ where: { isTracked: true } });
    const rows = await Promise.all(stocks.map(async stock => {
      const latest = await Fundamental.findOne({
        where: { stockId: stock.id },
        order: [['snapshotDate', 'DESC']],
      });

      let fundamentals = latest ? latest.get({ plain: true }) : null;
      const snapshotTime = fundamentals?.snapshotAt ? new Date(fundamentals.snapshotAt).getTime() : 0;
      const stale = !snapshotTime || (Date.now() - snapshotTime) > 24 * 60 * 60 * 1000;

      if (!fundamentals || stale) {
        try {
          const live = await provider.fetchFundamentals(stock.symbol);
          if (live) {
            fundamentals = { ...fundamentals, ...live };
          }
        } catch (err) {
          console.warn(`[analytics] live score fundamentals for ${stock.symbol}:`, err.message);
        }
      }

      const score = fundamentals ? analytics.scoreFundamental(fundamentals) : null;
      return {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        sector: stock.sector,
        lastSyncedAt: stock.lastSyncedAt,
        snapshotDate: latest ? latest.snapshotDate : null,
        fundamentals,
        score,
      };
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/compare?symbols=AAPL,MSFT - side-by-side metrics for comparison
router.get('/compare', validate({ query: schemas.analyticsCompare }), async (req, res) => {
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
              order: [['date', 'ASC']],
              limit: 400,
            });
          }
        } catch (err) {
          console.warn(`[analytics] compare DB for ${symbol}:`, err.message);
        }

        if (priceHistory.length < 90) {
          try {
            priceHistory = await provider.fetchHistory(symbol, '1y', '1d', 400);
          } catch (err) {
            console.warn(`[analytics] compare history for ${symbol}:`, err.message);
          }
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
router.get('/news', validate({ query: schemas.analyticsNews }), async (req, res) => {
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
