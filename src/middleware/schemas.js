const { z } = require('zod');

const symbol = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._^=-]+$/, 'Invalid stock symbol');
const shortText = z.string().trim().min(1).max(200);
const relationType = z.string().trim().min(1).max(50);

const schemas = {
  listStocks: z.object({
    sector: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).max(100000).optional(),
  }),
  searchStocks: z.object({
    query: z.string().trim().min(1).max(100),
  }),
  createStock: z.object({
    symbol,
    name: shortText,
    sector: z.string().trim().max(100).optional(),
    industry: z.string().trim().max(150).optional(),
    currency: z.string().trim().max(10).optional(),
    marketCap: z.union([z.string().max(40), z.number().finite()]).optional(),
    fetchOnCreate: z.coerce.boolean().optional(),
  }),
  stockSymbol: z.object({ symbol }),
  history: z.object({
    start: z.string().trim().max(30).optional(),
    end: z.string().trim().max(30).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    days: z.coerce.number().int().min(1).max(3650).optional(),
  }),
  yahooHistory: z.object({
    range: z.enum(['1mo', '3mo', '6mo', '1y', '2y', '5y']).optional(),
    interval: z.enum(['1d', '1wk', '1mo']).optional(),
  }),
  analyticsCompare: z.object({
    symbols: z.string().trim().max(1000).optional(),
  }),
  analyticsNews: z.object({
    type: z.enum(['company', 'geopolitics']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
  comparisonItem: z.object({
    stockId: z.coerce.number().int().positive(),
    weight: z.coerce.number().finite().min(0).max(1000).optional(),
    notes: z.string().max(1000).optional(),
  }),
  createComparison: z.object({
    name: shortText.max(100),
    description: z.string().max(2000).optional(),
    items: z.array(z.object({
      stockId: z.coerce.number().int().positive(),
      weight: z.coerce.number().finite().min(0).max(1000).optional(),
      notes: z.string().max(1000).optional(),
    })).max(50).optional(),
  }),
  updateComparison: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    items: z.array(z.object({
      stockId: z.coerce.number().int().positive(),
      weight: z.coerce.number().finite().min(0).max(1000).optional(),
      notes: z.string().max(1000).optional(),
    })).max(50).optional(),
  }),
  comparisonId: z.object({ id: z.coerce.number().int().positive() }),
  comparisonStockId: z.object({ id: z.coerce.number().int().positive(), stockId: z.coerce.number().int().positive() }),
  addStockToComparison: z.object({
    stockId: z.coerce.number().int().positive(),
    weight: z.coerce.number().finite().min(0).max(1000).optional(),
    notes: z.string().max(1000).optional(),
  }),
  competitorSymbol: z.object({ symbol }),
  addCompetitor: z.object({ competitorSymbol: symbol, relationType: relationType.optional() }),
  removeCompetitor: z.object({ symbol, competitorSymbol: symbol }),
};

module.exports = schemas;
