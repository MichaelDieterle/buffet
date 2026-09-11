const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { User, Portfolio, Holding, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

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
