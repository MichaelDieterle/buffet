const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const rateLimit = require('express-rate-limit');
const { Readable } = require('stream');
const { Portfolio, Holding, sequelize } = require('../models');
const provider = require('../services/provider');
const router = express.Router();

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_CSV_ROWS = 20000;
const MAX_UNIQUE_ASSETS = 100;
const IMPORT_TIMEOUT_MS = 4500;

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele CSV-Importe. Bitte später erneut versuchen.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 10, parts: 12 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').trim().toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedMime = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream']);
    if (name.endsWith('.csv') && (allowedMime.has(mime) || !mime)) return cb(null, true);
    cb(new Error('Only CSV files are supported'));
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

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function resolveYahooSymbol(row, cache) {
  const raw = String(row.symbol || '').trim().toUpperCase();
  const name = String(row.name || '').trim();
  const cacheKey = `${raw}|${name}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let resolved = null;
  // Trade Republic exports ISINs. Prefer the human-readable company name because
  // Yahoo search is substantially more reliable for names than for ISIN strings.
  const queries = [name, raw].filter((query, index, list) => query && list.indexOf(query) === index);
  for (const query of queries) {
    try {
      const results = await withTimeout(provider.searchSymbol(query), IMPORT_TIMEOUT_MS);
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
    const quotes = tickers.length ? await provider.fetchQuotes(tickers) : {};
    const fundamentals = await Promise.all(tickers.map(async ticker => ({ ticker, ...(await provider.fetchFundamentals(ticker).catch(() => ({}))) })));
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

router.post('/import', importLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
  try {
    const results = [];
    const separator = detectSeparator(req.file.buffer);
    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer.toString('utf8').replace(/^\uFEFF/, ''))
        .pipe(csv({ separator, maxRowBytes: 1024 * 1024, mapHeaders: ({ header }) => String(header).replace(/^\uFEFF/, '').trim().toLowerCase() }))
        .on('data', data => {
          if (results.length < MAX_CSV_ROWS) results.push(normalizeRow(data));
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (!results.length) return res.status(400).json({ error: 'Die CSV-Datei ist leer.' });
    const headerKeys = new Set(Object.keys(results[0]));
    const requiredHeaders = ['type', 'asset_class', 'symbol', 'shares', 'price'];
    if (!requiredHeaders.every(key => headerKeys.has(key))) {
      return res.status(400).json({ error: 'Ungültiges CSV-Format. Erwartet wird ein Trade-Republic-Transaktionsexport.' });
    }

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
      .filter(row => looksLikeIsin(row.isin) && row.quantity > 0 && row.price >= 0 && Number.isFinite(row.quantity) && Number.isFinite(row.price))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!trades.length) return res.status(400).json({ error: 'Keine gültigen Aktien-Transaktionen (BUY/SELL) in der CSV gefunden.' });

    const uniqueAssets = [...new Map(trades.map(trade => [`${trade.isin}|${trade.name}`, trade])).values()];
    if (uniqueAssets.length > MAX_UNIQUE_ASSETS) return res.status(400).json({ error: `Die CSV enthält zu viele unterschiedliche Aktien. Maximal ${MAX_UNIQUE_ASSETS} werden pro Import unterstützt.` });

    const cache = new Map();
    const resolvedAssets = await Promise.all(uniqueAssets.map(async trade => ({
      key: `${trade.isin}|${trade.name}`,
      resolved: await resolveYahooSymbol({ symbol: trade.isin, name: trade.name }, cache),
    })));
    const resolutionMap = new Map(resolvedAssets.map(item => [item.key, item.resolved]));

    const positions = new Map();
    const unresolved = [];
    for (const trade of trades) {
      const resolved = resolutionMap.get(`${trade.isin}|${trade.name}`);
      if (!resolved) {
        unresolved.push(trade.name || trade.isin);
        continue;
      }
      applyTransaction(positions, { ...trade, ticker: resolved.symbol });
    }

    const holdingsToCreate = [...positions.values()]
      .filter(position => position.quantity > 0.00000001)
      .map(position => ({ ticker: position.ticker, quantity: position.quantity, averagePrice: position.averagePrice, currency: position.currency }));

    if (!holdingsToCreate.length) return res.status(400).json({ error: 'Es konnten keine handelbaren Aktien aus der CSV ermittelt werden.', unresolved: [...new Set(unresolved)] });

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
      unresolved: [...new Set(unresolved)],
      holdings: holdingsToCreate.map(h => h.ticker),
    });
  } catch (err) {
    console.error('CSV Import Error:', err);
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'CSV-Datei ist zu groß (maximal 5 MB).' });
    if (err?.code === 'LIMIT_PART_COUNT' || err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_FIELD_COUNT') return res.status(400).json({ error: 'Ungültiger Datei-Upload.' });
    if (err.message === 'Only CSV files are supported') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'CSV-Import konnte auf dem Server nicht abgeschlossen werden.' });
  }
});

module.exports = router;
