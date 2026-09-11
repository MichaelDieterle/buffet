const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { User, Portfolio, Holding, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const yahooService = require('../services/yahooService');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// GET /api/portfolios/valuation
router.get('/valuation', authenticate, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { userId: req.user.id },
      include: [{ model: Holding, as: 'holdings' }],
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const tickers = portfolio.holdings.map(h => h.ticker);
    const quotes = await yahooService.fetchQuotes(tickers);
    const fundamentals = await Promise.all(
      tickers.map(async t => {
        const f = await yahooService.fetchFundamentals(t);
        return { ticker: t, ...f };
      })
    );

    let totalValue = 0;
    let totalCost = 0;

    const valuation = portfolio.holdings.map(h => {
      const quote = quotes[h.ticker];
      const price = quote?.price || 0;
      const currentVal = h.quantity * price;
      const cost = h.quantity * h.averagePrice;

      totalValue += currentVal;
      totalCost += cost;

      return {
        ticker: h.ticker,
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        currentPrice: price,
        currentValue: currentVal,
        profit: currentVal - cost,
        profitPercent: cost !== 0 ? ((currentVal - cost) / cost) * 100 : 0,
        sector: fundamentals.find(f => f.ticker === h.ticker)?.sector || 'Unknown',
      };
    });

    const sectorDist = {};
    valuation.forEach(v => {
      sectorDist[v.sector] = (sectorDist[v.sector] || 0) + v.currentValue;
    });

    res.json({
      totalValue,
      totalProfit: totalValue - totalCost,
      totalProfitPercent: totalCost !== 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      holdings: valuation,
      sectorDistribution: sectorDist,
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

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/portfolios/import
router.post('/import', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const filePath = req.file.path;

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const transaction = await sequelize.transaction();

    try {
      // 1. Get or create portfolio for user
      let [portfolio] = await Portfolio.findOrCreate({
        where: { userId: req.user.id },
        transaction,
      });

      // 2. Clear existing holdings for a fresh import
      await Holding.destroy({
        where: { portfolioId: portfolio.id },
        transaction,
      });

      // 3. Parse and save holdings
      // Trade Republic CSV typical columns: "Symbol", "Shares", "Average Price", "Currency"
      // We handle potential differences in column naming
      const holdingsToCreate = results
        .filter(row => row.Symbol && row.Shares)
        .map(row => ({
          portfolioId: portfolio.id,
          ticker: row.Symbol,
          quantity: parseFloat(row.Shares.replace(',', '.')),
          averagePrice: parseFloat((row['Average Price'] || row.Price || '0').replace(',', '.')),
          currency: row.Currency || 'EUR',
        }));

      await Holding.bulkCreate(holdingsToCreate, { transaction });

      await transaction.commit();

      // Cleanup uploaded file
      fs.unlinkSync(filePath);

      res.json({
        message: 'Portfolio imported successfully',
        count: holdingsToCreate.length,
      });
    } catch (err) {
      await transaction.rollback();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw err;
    }
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('CSV Import Error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

module.exports = router;
