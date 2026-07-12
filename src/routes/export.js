const express = require('express');
const router = express.Router();
const { Stock, PriceHistory, News, Fundamental, Dividend, Earning, CalendarEvent } = require('../models');
const indicator = require('../services/indicator');

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => csvEscape(r[h])).join(','));
  }
  return lines.join('\r\n');
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) {
      out[key] = '';
    } else if (v instanceof Date) {
      out[key] = v.toISOString();
    } else if (Array.isArray(v)) {
      out[key] = v.map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join('|');
    } else if (typeof v === 'object') {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

async function getStockOr404(symbol) {
  const stock = await Stock.findOne({ where: { symbol: symbol.toUpperCase() } });
  if (!stock) return null;
  return stock;
}

router.get('/:symbol/export.csv', async (req, res) => {
  try {
    const stock = await getStockOr404(req.params.symbol);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const [priceHistory, news, fundamentals, dividends, earnings, events] = await Promise.all([
      PriceHistory.findAll({ where: { stockId: stock.id }, order: [['date', 'ASC']] }),
      News.findAll({ where: { stockId: stock.id }, order: [['publishedAt', 'DESC']] }),
      Fundamental.findAll({ where: { stockId: stock.id }, order: [['snapshotAt', 'DESC']] }),
      Dividend.findAll({ where: { stockId: stock.id }, order: [['payDate', 'DESC']] }),
      Earning.findAll({ where: { stockId: stock.id }, order: [['reportDate', 'DESC']] }),
      CalendarEvent.findAll({ where: { stockId: stock.id }, order: [['eventDate', 'ASC']] }),
    ]);

    const stockFlat = flatten(stock.toJSON());
    const stockHeaders = Object.keys(stockFlat);
    const stockCsv = `# stock\r\n${rowsToCsv(stockHeaders, [stockFlat])}`;

    const blocks = [];
    if (priceHistory.length) {
      const plain = priceHistory.map(ph => ph.get({ plain: true }));
      const closes = plain.map(p => parseFloat(p.close));
      const ind = indicator.computeIndicators(closes);
      const enhanced = plain.map((p, idx) => ({
       ...p,
       sma_20: ind.sma_20[idx],
       sma_50: ind.sma_50[idx],
       ema_12: ind.ema_12[idx],
       ema_26: ind.ema_26[idx],
       rsi: ind.rsi[idx],
       macd: ind.macd[idx],
       macd_signal: ind.macd_signal[idx],
       macd_hist: ind.macd_hist[idx],
      }));
      const headers = Object.keys(enhanced[0]);
      blocks.push(`# price_history\r\n${rowsToCsv(headers, enhanced)}`);
    }
    if (news.length) {
      const flat = news.map(r => flatten(r.toJSON()));
      const headers = Object.keys(flat[0]);
      blocks.push(`# news\r\n${rowsToCsv(headers, flat)}`);
    }
    if (fundamentals.length) {
      const flat = fundamentals.map(r => flatten(r.toJSON()));
      const headers = Object.keys(flat[0]);
      blocks.push(`# fundamentals\r\n${rowsToCsv(headers, flat)}`);
    }
    if (dividends.length) {
      const flat = dividends.map(r => flatten(r.toJSON()));
      const headers = Object.keys(flat[0]);
      blocks.push(`# dividends\r\n${rowsToCsv(headers, flat)}`);
    }
    if (earnings.length) {
      const flat = earnings.map(r => flatten(r.toJSON()));
      const headers = Object.keys(flat[0]);
      blocks.push(`# earnings\r\n${rowsToCsv(headers, flat)}`);
    }
    if (events.length) {
      const flat = events.map(r => flatten(r.toJSON()));
      const headers = Object.keys(flat[0]);
      blocks.push(`# calendar_events\r\n${rowsToCsv(headers, flat)}`);
    }

    const body = [stockCsv, ...blocks].join('\r\n\r\n');
    const filename = `${stock.symbol}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
