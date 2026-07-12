const express = require('express');
const router = express.Router();
const { Stock, Competitor } = require('../models');

// GET competitors for a stock
router.get('/:symbol/competitors', async (req, res) => {
  try {
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const competitors = await Competitor.findAll({
      where: { stockId: stock.id },
      include: [{ model: Stock, as: 'competitorStock' }],
    });

    // Format response
    const result = competitors.map(c => ({
      id: c.id,
      competitorSymbol: c.competitorStock.symbol,
      competitorName: c.competitorStock.name,
      relationType: c.relationType,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST to add a competitor relationship (optional)
router.post('/:symbol/competitors', async (req, res) => {
  try {
    const { competitorSymbol, relationType = 'peer' } = req.body;
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const competitorStock = await Stock.findOne({ where: { symbol: competitorSymbol.toUpperCase() } });
    if (!competitorStock) return res.status(404).json({ error: 'Competitor stock not found' });

    // Avoid duplicate
    const existing = await Competitor.findOne({
      where: { stockId: stock.id, competitorId: competitorStock.id },
    });
    if (existing) {
      if (relationType) await existing.update({ relationType });
      return res.json(existing);
    }

    const relation = await Competitor.create({
      stockId: stock.id,
      competitorId: competitorStock.id,
      relationType,
    });
    res.status(201).json(relation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE competitor relationship
router.delete('/:symbol/competitors/:competitorSymbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ where: { symbol: req.params.symbol.toUpperCase() } });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const competitorStock = await Stock.findOne({ where: { symbol: req.params.competitorSymbol.toUpperCase() } });
    if (!competitorStock) return res.status(404).json({ error: 'Competitor stock not found' });

    const deleted = await Competitor.destroy({
      where: { stockId: stock.id, competitorId: competitorStock.id },
    });
    if (deleted === 0) return res.status(404).json({ error: 'Relation not found' });

    res.json({ message: 'Competitor relationship removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
