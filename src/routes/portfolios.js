const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { Portfolio, Holding, sequelize } = require('../models');
const yahooService = require('../services/yahooService');
const provider = require('../services/provider');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV files are supported'));
  },
});

function parseNumber(value) {
  if (value == null || value === '') return NaN;
  let s = String(value).trim().replace(/\s/g, '').replace(/'/g, '');
  if (!s) return NaN;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (comma >= 0) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).replace(/^\uFEFF/, '').trim().toLowerCase(), typeof value === 'string' ? value.trim() : value]));
}

function detectSeparator(buffer) {
  const firstLine = buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).find(Boolean) || '';
  const counts = [',', ';', '\t'].map(separator => ({ separator, count: firstLine.split(separator).length - 1 }));
  return counts.sort((a, b) => b.count - a.count)[0]?.separator || ',';
}

function looksLikeIsin(value) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(value || '').trim().toUpperCase());
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function resolveYahooSymbol(row, cache) {
  const raw = String(row.symbol || '').trim().toUpperCase();
  const name = String(row.name || '').trim();
  const cacheKey = `${raw}|${name}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let resolved = null;
  const queries = looksLikeIsin(raw) ? [raw, name] : [raw || name];
  for (const query of queries) {
    if (!query) continue;
    try {
      const results = await provider.searchSymbol(query);
      const equities = (results || []).filter(result => result?.symbol && (!result.quoteType || String(result.quoteType).toUpperCase() === 'EQUITY'));
      const target = normalizeName(name);
      equities.sort((a, b) => {
        const aName = normalizeName(a.name);
        const bName = normalizeName(b.name);
        const aScore = (target && aName === target ? 100 : 0) + (target && aName.includes(target) ? 20 : 0) + (a.exchangeDisplay === 'XETRA' ? 5 : 0);
        const bScore = (target && bName === target ? 100 : 0) + (target && bName.includes(target) ? 20 : 0) + (b.exchangeDisplay === 'XETRA' ? 5 : 0);
        return bScore - aScore;
      });
      if (equities[0]?.symbol) {
        resolved = { symbol: String(equities[0].symbol).toUpperCase(), name: equities[0].name || name };
        break;
      }
    } catch (err) {
      console.error(`[CSV import] symbol lookup failed for ${query}:`, err.message);
    }
  }

  cache.set(cacheKey, resolved);
  return resolved;
}

function applyTransaction(positions, transaction) {
  const existing = positions.get(transaction.ticker) || { ticker: transaction.ticker, quantity: 0, totalCost: 0, averagePrice: 0, currency: transaction.currency || 'EUR' };
  if (transaction.type === 'BUY') {
    existing.quantity += transaction.quantity;
    existing.totalCost += transaction.quantity * transaction.price;
  } else if (transaction.type === 'SELL') {
    const sold = Math.min(existing.quantity, transaction.quantity);
    const average = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0;
    existing.quantity -= sold;
    existing.totalCost -= sold * average;
  }
  if (existing.quantity > 0) existing.averagePrice = existing.totalCost / existing.quantity;
  else { existing.quantity = 0; existing.totalCost = 0; existing.averagePrice = 0; }
  positions.set(transaction.ticker, existing);
}

async function getGlobalPortfolio(options = {}) {
  return Portfolio.findOne({ order: [['id', 'ASC']], ...options });
}

router.get('/valuation', async (req, res) => {
  try {
    const portfolio = await getGlobalPortfolio({ include: [{ model: Holding, as: 'holdings' }] });
    if (!portfolio) return res.json({ totalValue: 0, totalProfit: 0, totalProfitPercent: 0, holdings: [], sectorDistribution: {} });
    const tickers = portfolio.holdings.map(h => h.ticker);
    const quotes = tickers.length ? await yahooService.fetchQuotes(tickers) : {};
    const fundamentals = await Promise.all(tickers.map(async ticker => ({ ticker, ...(await yahooService.fetchFundamentals(ticker).catch(() => ({}))) })));
    let totalValue = 0, totalCost = 0;
    const valuation = portfolio.holdings.map(h => {
      const quote = quotes[h.ticker]; const price = Number(quote?.price) || 0; const quantity = Number(h.quantity) || 0; const averagePrice = Number(h.averagePrice) || 0;
      const currentValue = quantity * price; const cost = quantity * averagePrice; totalValue += currentValue; totalCost += cost;
      return { ticker: h.ticker, quantity, averagePrice, currentPrice: price, currentValue, profit: currentValue - cost, profitPercent: cost ? ((currentValue - cost) / cost) * 100 : 0, sector: fundamentals.find(f => f.ticker === h.ticker)?.sector || 'Unknown' };
    });
    const sectorDistribution = {};
    valuation.forEach(v => { sectorDistribution[v.sector] = (sectorDistribution[v.sector] || 0) + v.currentValue; });
    res.json({ totalValue, totalProfit: totalValue - totalCost, totalProfitPercent: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0, holdings: valuation, sectorDistribution });
  } catch (err) { console.error('Valuation Error:', err); res.status(500).json({ error: 'Server error during valuation' }); }
});

router.get('/', async (req, res) => {
  try {
    const portfolio = await getGlobalPortfolio({ include: [{ model: Holding, as: 'holdings' }] });
    res.json(portfolio || { holdings: [] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
  try {
    const results = [];
    const separator = detectSeparator(req.file.buffer);
    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer.toString('utf8').replace(/^\uFEFF/, ''))
        .pipe(csv({ separator, mapHeaders: ({ header }) => String(header).replace(/^\uFEFF/, '').trim().toLowerCase() }))
        .on('data', data => results.push(normalizeRow(data)))
        .on('end', resolve)
        .on('error', reject);
    });

    const trades = results
      .filter(row => ['BUY', 'SELL'].includes(String(row.type || '').toUpperCase()) && String(row.asset_class || '').toUpperCase() === 'STOCK')
      .map(row => ({
        date: row.datetime || row.date || '',
        type: String(row.type).toUpperCase(),
        isin: String(row.symbol || '').trim().toUpperCase(),
        name: String(row.name || '').trim(),
        quantity: parseNumber(row.shares),
        price: parseNumber(row.price),
        currency: String(row.currency || 'EUR').trim().toUpperCase(),
      }))
      .filter(row => row.isin && row.quantity > 0 && row.price >= 0 && Number.isFinite(row.quantity) && Number.isFinite(row.price))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!trades.length) return res.status(400).json({ error: 'Keine Aktien-Transaktionen (BUY/SELL) in der CSV gefunden.' });

    const cache = new Map();
    const positions = new Map();
    const unresolved = [];
    for (const trade of trades) {
      const resolved = await resolveYahooSymbol({ symbol: trade.isin, name: trade.name }, cache);
      if (!resolved) {
        unresolved.push(trade.name || trade.isin);
        continue;
      }
      applyTransaction(positions, { ...trade, ticker: resolved.symbol });
    }

    const holdingsToCreate = [...positions.values()]
      .filter(position => position.quantity > 0.00000001)
      .map(position => ({ ticker: position.ticker, quantity: position.quantity, averagePrice: position.averagePrice, currency: position.currency }));

    if (!holdingsToCreate.length) return res.status(400).json({ error: 'Es konnten keine handelbaren Aktien aus der CSV ermittelt werden.' });

    const transaction = await sequelize.transaction();
    try {
      let portfolio = await getGlobalPortfolio({ transaction, lock: transaction.LOCK.UPDATE });
      if (!portfolio) portfolio = await Portfolio.create({}, { transaction });
      await Holding.destroy({ where: { portfolioId: portfolio.id }, transaction });
      await Holding.bulkCreate(holdingsToCreate.map(h => ({ ...h, portfolioId: portfolio.id })), { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({
      message: 'Portfolio imported successfully',
      count: holdingsToCreate.length,
      transactions: trades.length,
      unresolved,
      holdings: holdingsToCreate.map(h => h.ticker),
    });
  } catch (err) {
    console.error('CSV Import Error:', err);
    res.status(500).json({ error: err.message === 'Only CSV files are supported' ? err.message : 'Failed to import CSV' });
  }
});

module.exports = router;
