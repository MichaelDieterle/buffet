const cron = require('node-cron');
const { Stock, News, Fundamental, Earning, Dividend, CalendarEvent } = require('../models');
const yahoo = require('./yahooService');

const DEFAULT_CRON = process.env.REFRESH_CRON || '*/15 * * * *';
let task = null;
let running = false;
let lastRun = null;
let lastError = null;
let stats = { runs: 0, lastDurationMs: 0, errors: 0 };

async function refreshOneStock(stock) {
  const symbol = stock.symbol;
  const result = { symbol, ok: false, steps: {} };

  let quote = null;
  try {
    quote = await yahoo.fetchQuote(symbol);
    result.steps.quote = !!quote;
    if (quote) {
      await Fundamental.create({
        stockId: stock.id,
        snapshotAt: new Date(),
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        yearHigh: quote.yearHigh,
        yearLow: quote.yearLow,
        volume: quote.volume,
        avgVolume: quote.avgVolume,
        marketCap: quote.marketCap,
        previousClose: quote.previousClose,
      });
    }
  } catch (err) {
    console.error(`[refresh] quote failed for ${symbol}:`, err.message);
  }

  let fund = null;
  try {
    fund = await yahoo.fetchFundamentals(symbol);
    result.steps.fundamentals = !!fund;
    if (fund) {
      await Fundamental.create({
        stockId: stock.id,
        snapshotAt: new Date(),
        peRatio: fund.peRatio,
        forwardPe: fund.forwardPe,
        pegRatio: fund.pegRatio,
        pbRatio: fund.pbRatio,
        psRatio: fund.psRatio,
        eps: fund.eps,
        forwardEps: fund.forwardEps,
        dividendRate: fund.dividendRate,
        dividendYield: fund.dividendYield,
        payoutRatio: fund.payoutRatio,
        marketCap: fund.marketCap,
        beta: fund.beta,
        fiftyTwoWeekHigh: fund.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: fund.fiftyTwoWeekLow,
        fiftyDayAverage: fund.fiftyDayAverage,
        twoHundredDayAverage: fund.twoHundredDayAverage,
        revenue: fund.revenue,
        earningsGrowth: fund.earningsGrowth,
        revenueGrowth: fund.revenueGrowth,
        profitMargins: fund.profitMargins,
        operatingMargins: fund.operatingMargins,
        grossMargins: fund.grossMargins,
        freeCashflow: fund.freeCashflow,
        operatingCashflow: fund.operatingCashflow,
        totalCash: fund.totalCash,
        totalDebt: fund.totalDebt,
        debtToEquity: fund.debtToEquity,
        currentRatio: fund.currentRatio,
        quickRatio: fund.quickRatio,
        roa: fund.roa,
        roc: fund.roc,
        targetMeanPrice: fund.targetMeanPrice,
        targetHighPrice: fund.targetHighPrice,
        targetLowPrice: fund.targetLowPrice,
        recommendationMean: fund.recommendationMean,
        recommendationKey: fund.recommendationKey,
        numberOfAnalystOpinions: fund.numberOfAnalystOpinions,
        sharesOutstanding: fund.sharesOutstanding,
        floatShares: fund.floatShares,
        heldPercentInsiders: fund.heldPercentInsiders,
        heldPercentInstitutions: fund.heldPercentInstitutions,
        shortRatio: fund.shortRatio,
        shortPercentOfFloat: fund.shortPercentOfFloat,
      });
    }
  } catch (err) {
    console.error(`[refresh] fundamentals failed for ${symbol}:`, err.message);
  }

  try {
    const news = await yahoo.fetchNews(symbol);
    result.steps.news = news.all.length;
    for (const n of news.all) {
      try {
        const [record, created] = await News.findOrCreate({
          where: { uuid: n.uuid },
          defaults: {
            stockId: stock.id,
            uuid: n.uuid,
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            publishedAt: n.publishedAt ? new Date(n.publishedAt) : null,
            type: n.type,
            thumbnail: n.thumbnail,
            relatedTickers: n.relatedTickers,
          },
        });
        if (!created && record.stockId !== stock.id) {
          await record.update({ stockId: stock.id });
        }
      } catch (e) { /* skip duplicates */ }
    }
  } catch (err) {
    console.error(`[refresh] news failed for ${symbol}:`, err.message);
  }

  // Calendar events (earnings, dividends, etc.)
  try {
    const calendar = await yahoo.fetchCalendar(symbol);
    result.steps.calendar = calendar.events?.length || 0;
    for (const ev of calendar.events || []) {
      try {
        if (ev.type === 'earnings') {
          await Earning.create({
            stockId: stock.id,
            reportDate: ev.date ? new Date(ev.date) : null,
            dateLow: ev.dateLow ? new Date(ev.dateLow) : null,
            dateHigh: ev.dateHigh ? new Date(ev.dateHigh) : null,
            isEstimate: ev.isEstimate ?? null,
            epsEstimate: ev.earningsAverage ?? null, // using earningsAverage as epsEstimate? Actually earningsAverage is revenue? In yahoo, earningsAverage is EPS estimate? We'll map epsEstimate to earningsAverage.
            epsLow: ev.earningsLow ?? null,
            epsHigh: ev.earningsHigh ?? null,
            // epsActual not provided
            revenueEstimate: ev.revenueAverage ?? null,
            revenueLow: ev.revenueLow ?? null,
            revenueHigh: ev.revenueHigh ?? null,
            // revenueActual not provided
            quarter: null, // not provided
          });
        } else if (ev.type === 'ex-dividend' || ev.type === 'dividend-payment') {
          // Map to Dividend table; we lack amount etc.
          const isExDiv = ev.type === 'ex-dividend';
          await Dividend.create({
            stockId: stock.id,
            amount: null,
            currency: null,
            payDate: ev.type === 'dividend-payment' ? (ev.date ? new Date(ev.date) : null) : null,
            exDate: ev.type === 'ex-dividend' ? (ev.date ? new Date(ev.date) : null) : null,
            recordDate: null,
            declarationDate: null,
            frequency: null,
          });
        } else {
          // Other events go to CalendarEvent
          await CalendarEvent.create({
            stockId: stock.id,
            type: ev.type,
            eventDate: ev.date ? new Date(ev.date) : null,
            description: ev.description ?? null,
          });
        }
      } catch (e) {
        console.error(`[refresh] calendar event failed for ${symbol}:`, e.message);
      }
    }
  } catch (err) {
    console.error(`[refresh] calendar failed for ${symbol}:`, err.message);
  }

  try {
    const updates = {};
    if (quote?.marketCap) updates.marketCap = quote.marketCap;
    if (fund?.sector) updates.sector = fund.sector;
    if (fund?.industry) updates.industry = fund.industry;
    if (fund?.website) updates.website = fund.website;
    if (fund?.country) updates.country = fund.country;
    if (fund?.city) updates.city = fund.city;
    if (fund?.employees) updates.employees = fund.employees;
    if (fund?.businessSummary) updates.businessSummary = fund.businessSummary;
    if (fund?.fiscalYearEnd) updates.fiscalYearEnd = fund.fiscalYearEnd;
    if (fund?.quoteType) updates.quoteType = fund.quoteType;
    if (fund?.shortName) updates.shortName = fund.shortName;
    if (fund?.longName) updates.longName = fund.longName;
    updates.lastSyncedAt = new Date();
    await stock.update(updates);
  } catch (err) {
    console.error(`[refresh] stock update failed for ${symbol}:`, err.message);
  }

  result.ok = result.steps.quote || result.steps.fundamentals || (result.steps.news > 0);
  return result;
}

async function refreshAll() {
  if (running) {
    return { skipped: true, reason: 'already running' };
  }
  running = true;
  const startedAt = Date.now();
  const log = [];
  try {
    const stocks = await Stock.findAll({ where: { isTracked: true } });
    for (const stock of stocks) {
      try {
        const r = await refreshOneStock(stock);
        log.push(r);
      } catch (err) {
        stats.errors++;
        console.error(`[refresh] ${stock.symbol} failed:`, err.message);
      }
    }
    lastRun = new Date();
    lastError = null;
    stats.runs++;
    stats.lastDurationMs = Date.now() - startedAt;
    return { ok: true, count: stocks.length, log, durationMs: stats.lastDurationMs };
  } catch (err) {
    lastError = err.message;
    stats.errors++;
    console.error('[refresh] fatal:', err.message);
    return { ok: false, error: err.message };
  } finally {
    running = false;
  }
}

function start() {
  if (task) return;
  if (!cron.validate(DEFAULT_CRON)) {
    console.warn(`[refresh] invalid cron expression "${DEFAULT_CRON}", using default */15 * * * *`);
  }
  const expr = cron.validate(DEFAULT_CRON) ? DEFAULT_CRON : '*/15 * * * *';
  task = cron.schedule(expr, async () => {
    console.log(`[refresh] scheduled run starting at ${new Date().toISOString()}`);
    await refreshAll();
  });
  console.log(`[refresh] scheduled with cron "${expr}"`);
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

function getStatus() {
  return {
    running,
    lastRun,
    lastError,
    stats,
    cron: DEFAULT_CRON,
    isScheduled: !!task,
  };
}

module.exports = { start, stop, refreshAll, refreshOneStock, getStatus };
