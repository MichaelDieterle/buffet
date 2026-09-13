const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { Portfolio, Holding, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const yahooService = require('../services/yahooService');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are supported'));
    }
  },
});

function parseNumber(value) {
  if (value == null || value === '') return NaN;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  return Number(normalized);
}

// GET /api/portfolios/valuation
router.get('/valuation', authenticate, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { userId: req.user.id },
      include: [{ model: Holding, as: 'holdings' }],
    });

    if (!portfolio) {
      return res.json({
        totalValue: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        holdings: [],
        sectorDistribution: {},
      });
    }

    const tickers = portfolio.holdings.map(h => h.ticker);
    const quotes = tickers.length ? await yahooService.fetchQuotes(tickers) : {};
    const fundamentals = await Promise.all(
      tickers.map(async ticker => ({
        ticker,
        ...(await yahooService.fetchFundamentals(ticker).catch(() => ({}))),
      }))
    );

    let totalValue = 0;
    let totalCost = 0;

    const valuation = portfolio.holdings.map(h => {
      const quote = quotes[h.ticker];
      const price = Number(quote?.price) || 0;
      const quantity = Number(h.quantity) || 0;
      const averagePrice = Number(h.averagePrice) || 0;
      const currentValue = quantity * price;
      const cost = quantity * averagePrice;

      totalValue += currentValue;
      totalCost += cost;

      return {
        ticker: h.ticker,
        quantity,
        averagePrice,
        currentPrice: price,
        currentValue,
        profit: currentValue - cost,
        profitPercent: cost !== 0 ? ((currentValue - cost) / cost) * 100 : 0,
        sector: fundamentals.find(f => f.ticker === h.ticker)?.sector || 'Unknown',
      };
    });

    const sectorDistribution = {};
    valuation.forEach(v => {
      sectorDistribution[v.sector] = (sectorDistribution[v.sector] || 0) + v.currentValue;
    });

    res.json({
      totalValue,
      totalProfit: totalValue - totalCost,
      totalProfitPercent: totalCost !== 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      holdings: valuation,
      sectorDistribution,
    });
  } catch (err) {
    console.error('Valuation Error:', err);
    res.status(500).json({ error: 'Server error during valuation' });
  }
});

// GET /api/portfolios
router.get('/', authenticate, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { userId: req.user.id },
      include: [{ model: Holding, as: 'holdings' }],
    });
    res.json(portfolio || { holdings: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/portfolios/import
router.post('/import', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const results = [];
  try {
    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer)
        .pipe(csv())
        .on('data', data => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const holdingsToCreate = results
      .filter(row => row.Symbol && row.Shares)
      .map(row => ({
        ticker: String(row.Symbol).trim().toUpperCase(),
        quantity: parseNumber(row.Shares),
        averagePrice: parseNumber(row['Average Price'] || row.Price),
        currency: row.Currency || 'EUR',
      }))
      .filter(row => row.ticker && Number.isFinite(row.quantity) && row.quantity > 0 && Number.isFinite(row.averagePrice) && row.averagePrice >= 0);

    if (!holdingsToCreate.length) {
      return res.status(400).json({ error: 'No valid holdings found in CSV' });
    }

    const transaction = await sequelize.transaction();
    try {
      const [portfolio] = await Portfolio.findOrCreate({
        where: { userId: req.user.id },
        defaults: { userId: req.user.id },
        transaction,
      });

      await Holding.destroy({ where: { portfolioId: portfolio.id }, transaction });
      await Holding.bulkCreate(
        holdingsToCreate.map(h => ({ ...h, portfolioId: portfolio.id })),
        { transaction }
      );
      await transaction.commit();

      res.json({ message: 'Portfolio imported successfully', count: holdingsToCreate.length });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('CSV Import Error:', err);
    res.status(500).json({ error: err.message === 'Only CSV files are supported' ? err.message : 'Failed to import CSV' });
  }
});

module.exports = router;
