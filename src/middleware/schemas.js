const { z } = require('zod');

const schemas = {
  // Stocks
  listStocks: z.object({
    query: z.object({
      sector: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
  }),
  searchStocks: z.object({
    params: z.object({
      query: z.string().min(1),
    }),
  }),
  createStock: z.object({
    body: z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      sector: z.string().optional(),
      industry: z.string().optional(),
      currency: z.string().optional(),
      marketCap: z.union([z.string(), z.number()]).optional(),
      fetchOnCreate: z.coerce.boolean().optional(),
    }),
  }),
  stockSymbol: z.object({
    params: z.object({
      symbol: z.string().min(1),
    }),
  }),
  history: z.object({
    params: z.object({
      symbol: z.string().min(1),
    }),
    query: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
      days: z.coerce.number().int().min(1).optional(),
    }),
  }),
  yahooHistory: z.object({
    params: z.object({
      symbol: z.string().min(1),
    }),
    query: z.object({
      range: z.string().optional(),
      interval: z.string().optional(),
    }),
  }),

  // Analytics
  analyticsCompare: z.object({
    query: z.object({
      symbols: z.string().optional(),
    }),
  }),
  analyticsNews: z.object({
    query: z.object({
      type: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
  }),

  // Comparisons
  comparisonItem: z.object({
    stockId: z.coerce.number().int().positive(),
    weight: z.coerce.number().optional(),
    notes: z.string().optional(),
  }),
  createComparison: z.object({
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      items: z.array(z.any()).optional(), // Better validation below
    }),
  }),
  updateComparison: z.object({
    body: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      items: z.array(z.any()).optional(),
    }),
  }),
  comparisonId: z.object({
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  }),
  comparisonStockId: z.object({
    params: z.object({
      id: z.coerce.number().int().positive(),
      stockId: z.coerce.number().int().positive(),
    }),
  }),
  addStockToComparison: z.object({
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: z.object({
      stockId: z.coerce.number().int().positive(),
      weight: z.coerce.number().optional(),
      notes: z.string().optional(),
    }),
  }),

  // Competitors
  competitorSymbol: z.object({
    params: z.object({
      symbol: z.string().min(1),
    }),
  }),
  addCompetitor: z.object({
    params: z.object({
      symbol: z.string().min(1),
    }),
    body: z.object({
      competitorSymbol: z.string().min(1),
      relationType: z.string().optional(),
    }),
  }),
  removeCompetitor: z.object({
    params: z.object({
      symbol: z.string().min(1),
      competitorSymbol: z.string().min(1),
    }),
  }),
};
};

module.exports = schemas;
