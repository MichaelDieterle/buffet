const express = require('express');
const validate = require('../middleware/validate');
const schemas = require('../middleware/schemas');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const { Comparison, ComparisonItem, Stock } = require('../models');

// GET all comparisons
router.get('/', async (req, res, next) => {
  try {
    const comparisons = await Comparison.findAll({
      include: [{ model: Stock, as: 'stocks', through: { attributes: ['weight', 'notes'] } }],
    });
    res.json(comparisons);
  } catch (err) {
    next(err);
  }
});

// POST create a new comparison
router.post('/', authenticate, validate({ body: schemas.createComparison }), async (req, res, next) => {
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
    next(err);
  }
});

// GET comparison by id with items
router.get('/:id', validate({ params: schemas.comparisonId }), async (req, res, next) => {
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
    next(err);
  }
});

// PATCH update name/description and full item set
router.patch('/:id', authenticate, validate({ params: schemas.comparisonId }), validate({ body: schemas.updateComparison }), async (req, res, next) => {
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
    next(err);
  }
});

// POST add a stock to a comparison
router.post('/:id/stocks', authenticate, validate({ params: schemas.comparisonId, body: schemas.addStockToComparison }), async (req, res, next) => {
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
    next(err);
  }
});

// DELETE remove a stock from a comparison
router.delete('/:id/stocks/:stockId', authenticate, validate({ params: schemas.comparisonStockId }), async (req, res, next) => {
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
    next(err);
  }
});

// DELETE remove a comparison entirely
router.delete('/:id', authenticate, validate({ params: schemas.comparisonId }), async (req, res, next) => {
  try {
    const comparison = await Comparison.findByPk(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    await ComparisonItem.destroy({ where: { comparisonId: comparison.id } });
    await comparison.destroy();
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
