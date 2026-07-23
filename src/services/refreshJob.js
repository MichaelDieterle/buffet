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

  // Fetch quote and fundamentals independently (errors are non-fatal)
  let quote = null;
  try {
    quote = await yahoo.fetchQuote(symbol);
    result.steps.quote = !!quote;
  } catch (err) {
    console.error(`[refresh] quote failed for ${symbol}:`, err.message);
  }

  let fund = null;
  try {
    fund = await yahoo.fetchFundamentals(symbol);
    result.steps.fundamentals = !!fund;
  } catch (err) {
    console.error(`[refresh] fundamentals failed for ${symbol}:`, err.message);
  }

  // Merge quote + fund into ONE Fundamental snapshot
  if (quote || fund) {
    try {
      await Fundamental.create({
        stockId: stock.id,
        snapshotAt: new Date(),
        // From quote
        price: quote?.price ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        dayHigh: quote?.dayHigh ?? null,
        dayLow: quote?.dayLow ?? null,
        yearHigh: quote?.yearHigh ?? null,
        yearLow: quote?.yearLow ?? null,
        volume: quote?.volume ?? null,
        avgVolume: quote?.avgVolume ?? null,
        previousClose: quote?.previousClose ?? null,
        // From fundamentals (prefer fund, fall back to quote for marketCap)
        marketCap: fund?.marketCap ?? quote?.marketCap ?? null,
        peRatio: fund?.peRatio ?? null,
        forwardPe: fund?.forwardPe ?? null,
        pegRatio: fund?.pegRatio ?? null,
        pbRatio: fund?.pbRatio ?? null,
        psRatio: fund?.psRatio ?? null,
        eps: fund?.eps ?? null,
        forwardEps: fund?.forwardEps ?? null,
        dividendRate: fund?.dividendRate ?? null,
        dividendYield: fund?.dividendYield ?? null,
        payoutRatio: fund?.payoutRatio ?? null,
        beta: fund?.beta ?? null,
        fiftyTwoWeekHigh: fund?.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: fund?.fiftyTwoWeekLow ?? null,
        fiftyDayAverage: fund?.fiftyDayAverage ?? null,
        twoHundredDayAverage: fund?.twoHundredDayAverage ?? null,
        revenue: fund?.revenue ?? null,
        earningsGrowth: fund?.earningsGrowth ?? null,
        revenueGrowth: fund?.revenueGrowth ?? null,
        profitMargins: fund?.profitMargins ?? null,
        operatingMargins: fund?.operatingMargins ?? null,
        grossMargins: fund?.grossMargins ?? null,
        freeCashflow: fund?.freeCashflow ?? null,
        operatingCashflow: fund?.operatingCashflow ?? null,
        totalCash: fund?.totalCash ?? null,
        totalDebt: fund?.totalDebt ?? null,
        debtToEquity: fund?.debtToEquity ?? null,
        currentRatio: fund?.currentRatio ?? null,
        quickRatio: fund?.quickRatio ?? null,
        roa: fund?.roa ?? null,
        roc: fund?.roc ?? null,
        targetMeanPrice: fund?.targetMeanPrice ?? null,
        targetHighPrice: fund?.targetHighPrice ?? null,
        targetLowPrice: fund?.targetLowPrice ?? null,
        recommendationMean: fund?.recommendationMean ?? null,
        recommendationKey: fund?.recommendationKey ?? null,
        numberOfAnalystOpinions: fund?.numberOfAnalystOpinions ?? null,
        sharesOutstanding: fund?.sharesOutstanding ?? null,
        floatShares: fund?.floatShares ?? null,
        heldPercentInsiders: fund?.heldPercentInsiders ?? null,
        heldPercentInstitutions: fund?.heldPercentInstitutions ?? null,
        shortRatio: fund?.shortRatio ?? null,
        shortPercentOfFloat: fund?.shortPercentOfFloat ?? null,
      });
    } catch (err) {
      console.error(`[refresh] fundamental create failed for ${symbol}:`, err.message);
    }
  }

  // News – already uses findOrCreate
  try {
    const news = await yahoo.fetchNews(symbol);
    result.steps.news = news.all.length;
    for (const n of news.all) {
      try {
        await News.findOrCreate({
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
      } catch (e) { /* skip */ }
    }
  } catch (err) {
    console.error(`[refresh] news failed for ${symbol}:`, err.message);
  }

  // Calendar events – use findOrCreate/upsert to avoid duplicates
  try {
    const calendar = await yahoo.fetchCalendar(symbol);
    result.steps.calendar = calendar.events?.length || 0;
    for (const ev of calendar.events || []) {
      try {
        if (ev.type === 'earnings') {
          const reportDate = ev.date ? new Date(ev.date) : null;
          await Earning.findOrCreate({
            where: { stockId: stock.id, reportDate },
            defaults: {
              dateLow: ev.dateLow ? new Date(ev.dateLow) : null,
              dateHigh: ev.dateHigh ? new Date(ev.dateHigh) : null,
              isEstimate: ev.isEstimate ?? null,
              epsEstimate: ev.earningsAverage ?? null,
              epsLow: ev.earningsLow ?? null,
              epsHigh: ev.earningsHigh ?? null,
              revenueEstimate: ev.revenueAverage ?? null,
              revenueLow: ev.revenueLow ?? null,
              revenueHigh: ev.revenueHigh ?? null,
              quarter: null,
            },
          });
        } else if (ev.type === 'ex-dividend' || ev.type === 'dividend-payment') {
          const exDate = ev.type === 'ex-dividend' ? (ev.date ? new Date(ev.date) : null) : null;
          await Dividend.findOrCreate({
            where: { stockId: stock.id, exDate },
            defaults: {
              amount: null,
              currency: null,
              payDate: ev.type === 'dividend-payment' ? (ev.date ? new Date(ev.date) : null) : null,
              recordDate: null,
              declarationDate: null,
              frequency: null,
            },
          });
        } else {
          const eventDate = ev.date ? new Date(ev.date) : null;
          await CalendarEvent.findOrCreate({
            where: { stockId: stock.id, type: ev.type, eventDate },
            defaults: { description: ev.description ?? null },
          });
        }
      } catch (e) {
        console.error(`[refresh] calendar event failed for ${symbol}:`, e.message);
      }
    }
  } catch (err) {
    console.error(`[refresh] calendar failed for ${symbol}:`, err.message);
  }

  // Update stock meta fields
  try {
    const updates = {};
    if (quote?.marketCap) updates.marketCap = quote.marketCap;
    if (fund?.sector)          updates.sector = fund.sector;
    if (fund?.industry)        updates.industry = fund.industry;
    if (fund?.website)         updates.website = fund.website;
    if (fund?.country)         updates.country = fund.country;
    if (fund?.city)            updates.city = fund.city;
    if (fund?.employees)       updates.employees = fund.employees;
    if (fund?.businessSummary) updates.businessSummary = fund.businessSummary;
    if (fund?.fiscalYearEnd)   updates.fiscalYearEnd = fund.fiscalYearEnd;
    updates.lastSyncedAt = new Date();
    await stock.update(updates);
  } catch (err) {
    console.error(`[refresh] stock update failed for ${symbol}:`, err.message);
  }

  result.ok = result.steps.quote || result.steps.fundamentals || (result.steps.news > 0);
  return result;
}

async function refreshAll() {
  if (running) return { skipped: true, reason: 'already running' };
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
    return { ok: false, error: err.message };
  } finally {
    running = false;
  }
}

function start() {
  if (task) return;
  const expr = cron.validate(DEFAULT_CRON) ? DEFAULT_CRON : '*/15 * * * *';
  task = cron.schedule(expr, async () => {
    console.log(`[refresh] scheduled run at ${new Date().toISOString()}`);
    await refreshAll();
  });
  console.log(`[refresh] scheduled with cron "${expr}"`);
}

function stop() {
  if (task) { task.stop(); task = null; }
}

function getStatus() {
  return { running, lastRun, lastError, stats, cron: DEFAULT_CRON, isScheduled: !!task };
}

module.exports = { start, stop, refreshAll, refreshOneStock, getStatus };
