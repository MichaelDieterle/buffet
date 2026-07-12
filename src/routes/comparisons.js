const express = require('express');
const router = express.Router();
const { Comparison, ComparisonItem, Stock } = require('../models');

// GET all comparisons
router.get('/', async (req, res) => {
  try {
    const comparisons = await Comparison.findAll({
      include: [{ model: Stock, as: 'stocks', through: { attributes: ['weight', 'notes'] } }],
    });
    res.json(comparisons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create a new comparison
router.post('/', async (req, res) => {
  try {
    const { name, description, items } = req.body; // items: [{ stockId, weight, notes }]
    const comparison = await Comparison.create({ name, description });
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await ComparisonItem.create({
          comparisonId: comparison.id,
          stockId: item.stockId,
          weight: item.weight ?? 1,
          notes: item.notes || null,
        });
      }
    }
    res.status(201).json(comparison);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET comparison by id with items
router.get('/:id', async (req, res) => {
  try {
    const comparison = await Comparison.findByPk(req.params.id, {
      include: [
        {
          model: Stock,
          as: 'stocks',
          through: { attributes: ['weight', 'notes'] },
        },
      ],
    });
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    res.json(comparison);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
