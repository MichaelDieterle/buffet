const express = require('express');
const validate = require('../middleware/validate');
const schemas = require('../middleware/schemas');
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
router.post('/', validate(schemas.createComparison), async (req, res) => {
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
    // Return the comparison with its items included
    const full = await Comparison.findByPk(comparison.id, {
      include: [{ model: Stock, as: 'stocks', through: { attributes: ['weight', 'notes'] } }],
    });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET comparison by id with items
router.get('/:id', validate(schemas.comparisonId), async (req, res) => {
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

// PATCH update name/description and full item set
router.patch('/:id', validate(schemas.comparisonId), validate(schemas.updateComparison), async (req, res) => {
  try {
    const comparison = await Comparison.findByPk(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    const { name, description, items } = req.body;
    if (name) comparison.name = name;
    if (description !== undefined) comparison.description = description;
    await comparison.save();

    if (items && Array.isArray(items)) {
      const validItems = items.filter(i => i && i.stockId);
      if (validItems.length) {
        await ComparisonItem.destroy({ where: { comparisonId: comparison.id } });
        for (const item of validItems) {
          await ComparisonItem.create({
            comparisonId: comparison.id,
            stockId: item.stockId,
            weight: item.weight ?? 1,
            notes: item.notes || null,
          });
        }
      }
    }
    const full = await Comparison.findByPk(comparison.id, {
      include: [{ model: Stock, as: 'stocks', through: { attributes: ['weight', 'notes'] } }],
    });
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST add a stock to a comparison
router.post('/:id/stocks', validate(schemas.addStockToComparison), async (req, res) => {
  try {
    const comparison = await Comparison.findByPk(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    const { stockId, weight, notes } = req.body;
    const stock = await Stock.findByPk(stockId);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    const [item, created] = await ComparisonItem.findOrCreate({
      where: { comparisonId: comparison.id, stockId },
      defaults: { weight: weight ?? 1, notes: notes || null },
    });
    if (!created) {
      item.weight = weight ?? item.weight;
      item.notes = notes !== undefined ? notes : item.notes;
      await item.save();
    }
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE remove a stock from a comparison
router.delete('/:id/stocks/:stockId', validate(schemas.comparisonStockId), async (req, res) => {
  try {
    const destroyed = await ComparisonItem.destroy({
      where: {
        comparisonId: req.params.id,
        stockId: req.params.stockId,
      },
    });
    if (!destroyed) return res.status(404).json({ error: 'Item not found' });
    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE remove a comparison entirely
router.delete('/:id', validate(schemas.comparisonId), async (req, res) => {
  try {
    const comparison = await Comparison.findByPk(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    await ComparisonItem.destroy({ where: { comparisonId: comparison.id } });
    await comparison.destroy();
    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
