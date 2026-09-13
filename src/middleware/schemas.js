const { z } = require('zod');

const schemas = {
  // Stocks
  listStocks: z.object({
    sector: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
  searchStocks: z.object({
    query: z.string().min(1),
  }),
  createStock: z.object({
    symbol: z.string().min(1),
    name: z.string().min(1),
    sector: z.string().optional(),
    industry: z.string().optional(),
    currency: z.string().optional(),
    marketCap: z.union([z.string(), z.number()]).optional(),
    fetchOnCreate: z.coerce.boolean().optional(),
  }),
  stockSymbol: z.object({
    symbol: z.string().min(1),
  }),
  // These schemas validate only query-string fields. The stock symbol is a
  // path parameter and is validated separately with stockSymbol.
  history: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    days: z.coerce.number().int().min(1).optional(),
  }),
  yahooHistory: z.object({
    range: z.string().optional(),
    interval: z.string().optional(),
  }),

  // Analytics
  analyticsCompare: z.object({
    symbols: z.string().optional(),
  }),
  analyticsNews: z.object({
    type: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),

  // Comparisons
  comparisonItem: z.object({
    stockId: z.coerce.number().int().positive(),
    weight: z.coerce.number().optional(),
    notes: z.string().optional(),
  }),
  createComparison: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    items: z.array(z.any()).optional(), // Better validation below
  }),
  updateComparison: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    items: z.array(z.any()).optional(),
  }),
  comparisonId: z.object({
    id: z.coerce.number().int().positive(),
  }),
  comparisonStockId: z.object({
    id: z.coerce.number().int().positive(),
    stockId: z.coerce.number().int().positive(),
  }),
  addStockToComparison: z.object({
    stockId: z.coerce.number().int().positive(),
    weight: z.coerce.number().optional(),
    notes: z.string().optional(),
  }),

  // Competitors
  competitorSymbol: z.object({
    symbol: z.string().min(1),
  }),
  addCompetitor: z.object({
    competitorSymbol: z.string().min(1),
    relationType: z.string().optional(),
  }),
  removeCompetitor: z.object({
    symbol: z.string().min(1),
    competitorSymbol: z.string().min(1),
  }),
};

module.exports = schemas;
