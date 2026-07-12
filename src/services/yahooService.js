const yahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 });

const NEWS_SOURCES = {
  GEOPOLITICS: [
    'Reuters', 'Associated Press', 'BBC', 'Bloomberg',
    'CNBC', 'Financial Times', 'The Wall Street Journal',
    'Nikkei', 'South China Morning Post', 'Al Jazeera',
    'Xinhua', 'TASS',
  ],
  COMPANY: [
    'PR Newswire', 'Business Wire', 'GlobeNewswire',
    'PRNewswire', 'Accesswire', 'EIN Presswire',
    'Yahoo Finance', 'MarketWatch', 'Seeking Alpha',
    'Zacks', 'Motley Fool', 'Investor Relations',
  ],
};

function classifyArticle(article) {
  const source = (article.publisher || '').trim();
  const title = (article.title || '').toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const text = `${title} ${summary}`;

  const geoKeywords = [
    'geopolit', 'sanction', 'tariff', 'trade war', 'embargo',
    'election', 'fed ', 'central bank', 'opec', 'war ', 'conflict',
    'tension', 'china', 'russia', 'iran', 'taiwan', 'israel',
    'brexit', 'eu ', 'germany', 'japan', 'india', 'brics',
    'inflation', 'rate', 'recession', 'gdp', 'macro', 'currency',
  ];

  if (NEWS_SOURCES.GEOPOLITICS.includes(source)) return 'geopolitics';
  if (geoKeywords.some(k => text.includes(k))) return 'geopolitics';
  if (NEWS_SOURCES.COMPANY.includes(source)) return 'company';
  return 'company';
}

function safeNumber(v) {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchQuote(symbol) {
  const key = `quote:${symbol}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const q = await yahooFinance.quote(symbol);
    const data = {
      symbol,
      price: safeNumber(q.regularMarketPrice),
      currency: q.currency || 'USD',
      change: safeNumber(q.regularMarketChange),
      changePercent: safeNumber(q.regularMarketChangePercent),
      dayHigh: safeNumber(q.regularMarketDayHigh),
      dayLow: safeNumber(q.regularMarketDayLow),
      yearHigh: safeNumber(q.fiftyTwoWeekHigh),
      yearLow: safeNumber(q.fiftyTwoWeekLow),
      volume: safeNumber(q.regularMarketVolume),
      avgVolume: safeNumber(q.averageDailyVolume3Month),
      marketCap: safeNumber(q.marketCap),
      previousClose: safeNumber(q.regularMarketPreviousClose),
      open: safeNumber(q.regularMarketOpen),
      bid: safeNumber(q.bid),
      ask: safeNumber(q.ask),
      bidSize: safeNumber(q.bidSize),
      askSize: safeNumber(q.askSize),
      preMarketPrice: safeNumber(q.preMarketPrice),
      preMarketChange: safeNumber(q.preMarketChange),
      preMarketChangePercent: safeNumber(q.preMarketChangePercent),
      currencySymbol: q.currencySymbol || null,
      exchangeName: q.fullExchangeName || q.exchange || null,
      marketState: q.marketState || null,
      quoteType: q.quoteType || null,
      shortName: q.shortName || null,
      longName: q.longName || null,
      timestamp: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    };
    cache.set(key, data, 30);
    return data;
  } catch (err) {
    console.error(`[yahoo] quote error for ${symbol}:`, err.message);
    return null;
  }
}

async function fetchFundamentals(symbol) {
  const key = `fund:${symbol}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: [
        'defaultKeyStatistics',
        'financialData',
        'summaryDetail',
        'price',
        'calendarEvents',
        'assetProfile',
      ],
    });
    const f = data => data || {};
    const s = f(summary.summaryDetail);
    const fd = f(summary.financialData);
    const ks = f(summary.defaultKeyStatistics);
    const p = f(summary.price);
    const ce = f(summary.calendarEvents);
    const ap = f(summary.assetProfile);

    const data = {
      symbol,
      peRatio: safeNumber(s.trailingPE) ?? safeNumber(fd.forwardPE),
      forwardPe: safeNumber(fd.forwardPE),
      pegRatio: safeNumber(ks.pegRatio),
      pbRatio: safeNumber(ks.priceToBook),
      psRatio: safeNumber(s.priceToSalesTrailing12Months),
      eps: safeNumber(s.trailingEps),
      forwardEps: safeNumber(fd.forwardEps),
      dividendRate: safeNumber(s.dividendRate),
      dividendYield: safeNumber(s.dividendYield),
      trailingAnnualDividendRate: safeNumber(s.trailingAnnualDividendRate),
      trailingAnnualDividendYield: safeNumber(s.trailingAnnualDividendYield),
      exDividendDate: s.exDividendDate ? new Date(s.exDividendDate * 1000).toISOString() : null,
      payoutRatio: safeNumber(s.payoutRatio),
      marketCap: safeNumber(s.marketCap) ?? safeNumber(p.marketCap),
      beta: safeNumber(ks.beta),
      fiftyTwoWeekHigh: safeNumber(s.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: safeNumber(s.fiftyTwoWeekLow),
      fiftyDayAverage: safeNumber(s.fiftyDayAverage),
      twoHundredDayAverage: safeNumber(s.twoHundredDayAverage),
      revenue: safeNumber(fd.totalRevenue),
      revenuePerShare: safeNumber(fd.revenuePerShare),
      earningsGrowth: safeNumber(fd.earningsGrowth),
      revenueGrowth: safeNumber(fd.revenueGrowth),
      profitMargins: safeNumber(fd.profitMargins),
      operatingMargins: safeNumber(fd.operatingMargins),
      grossMargins: safeNumber(fd.grossMargins),
      freeCashflow: safeNumber(fd.freeCashflow),
      operatingCashflow: safeNumber(fd.operatingCashflow),
      totalCash: safeNumber(fd.totalCash),
      totalDebt: safeNumber(fd.totalDebt),
      debtToEquity: safeNumber(fd.debtToEquity),
      currentRatio: safeNumber(fd.currentRatio),
      quickRatio: safeNumber(fd.quickRatio),
      roa: safeNumber(fd.returnOnAssets),
      roc: safeNumber(fd.returnOnEquity),
      targetMeanPrice: safeNumber(fd.targetMeanPrice),
      targetHighPrice: safeNumber(fd.targetHighPrice),
      targetLowPrice: safeNumber(fd.targetLowPrice),
      recommendationMean: safeNumber(fd.recommendationMean),
      recommendationKey: fd.recommendationKey || null,
      numberOfAnalystOpinions: safeNumber(fd.numberOfAnalystOpinions),
      sharesOutstanding: safeNumber(ks.sharesOutstanding),
      floatShares: safeNumber(ks.floatShares),
      heldPercentInsiders: safeNumber(ks.heldPercentInsiders),
      heldPercentInstitutions: safeNumber(ks.heldPercentInstitutions),
      shortRatio: safeNumber(s.shortRatio),
      shortPercentOfFloat: safeNumber(ks.shortPercentOfFloat),
      sector: ap.sector || null,
      industry: ap.industry || null,
      website: ap.website || null,
      country: ap.country || null,
      city: ap.city || null,
      employees: safeNumber(ap.fullTimeEmployees),
      businessSummary: ap.longBusinessSummary || null,
      fiscalYearEnd: ap.fiscalYearEnd || null,
      nextEarningsDate: ce?.earnings?.earningsDate?.[0]
        ? new Date(ce.earnings.earningsDate[0] * 1000).toISOString()
        : null,
      earningsDateLow: ce?.earnings?.earningsDate?.[0]
        ? new Date(ce.earnings.earningsDate[0] * 1000).toISOString()
        : null,
      earningsDateHigh: ce?.earnings?.earningsDate?.[1]
        ? new Date(ce.earnings.earningsDate[1] * 1000).toISOString()
        : null,
      isEarningsDateEstimate: ce?.earnings?.isEarningsDateEstimate ?? null,
      earningsAverage: safeNumber(ce?.earnings?.earningsAverage),
      earningsLow: safeNumber(ce?.earnings?.earningsLow),
      earningsHigh: safeNumber(ce?.earnings?.earningsHigh),
      revenueAverage: safeNumber(ce?.earnings?.revenueAverage),
      exDividendDateFromCalendar: ce?.exDividendDate?.date
        ? new Date(ce.exDividendDate.date * 1000).toISOString()
        : null,
      dividendDateFromCalendar: ce?.dividendDate?.date
        ? new Date(ce.dividendDate.date * 1000).toISOString()
        : null,
      lastUpdated: new Date().toISOString(),
    };
    cache.set(key, data, 300);
    return data;
  } catch (err) {
    console.error(`[yahoo] fundamentals error for ${symbol}:`, err.message);
    return null;
  }
}

async function fetchNews(symbol) {
  const key = `news:${symbol}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const raw = await yahooFinance.search(symbol, { newsCount: 30 });
    const news = (raw.news || []).map(n => ({
      uuid: n.uuid,
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : null,
      type: classifyArticle(n),
      relatedTickers: n.relatedTickers || [],
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
    }));
    const grouped = {
      all: news,
      company: news.filter(n => n.type === 'company'),
      geopolitics: news.filter(n => n.type === 'geopolitics'),
    };
    cache.set(key, grouped, 180);
    return grouped;
  } catch (err) {
    console.error(`[yahoo] news error for ${symbol}:`, err.message);
    return { all: [], company: [], geopolitics: [] };
  }
}

async function fetchCalendar(symbol) {
  const key = `cal:${symbol}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['calendarEvents'],
    });
    const ce = summary.calendarEvents || {};
    const events = [];

    if (ce.earnings) {
      const e = ce.earnings;
      events.push({
        type: 'earnings',
        symbol,
        date: e.earningsDate?.[0] ? new Date(e.earningsDate[0] * 1000).toISOString() : null,
        dateLow: e.earningsDate?.[0] ? new Date(e.earningsDate[0] * 1000).toISOString() : null,
        dateHigh: e.earningsDate?.[1] ? new Date(e.earningsDate[1] * 1000).toISOString() : null,
        isEstimate: e.isEarningsDateEstimate ?? null,
        earningsAverage: safeNumber(e.earningsAverage),
        earningsLow: safeNumber(e.earningsLow),
        earningsHigh: safeNumber(e.earningsHigh),
        revenueAverage: safeNumber(e.revenueAverage),
        revenueLow: safeNumber(e.revenueLow),
        revenueHigh: safeNumber(e.revenueHigh),
      });
    }
    if (ce.exDividendDate) {
      events.push({
        type: 'ex-dividend',
        symbol,
        date: ce.exDividendDate.date ? new Date(ce.exDividendDate.date * 1000).toISOString() : null,
      });
    }
    if (ce.dividendDate) {
      events.push({
        type: 'dividend-payment',
        symbol,
        date: ce.dividendDate.date ? new Date(ce.dividendDate.date * 1000).toISOString() : null,
      });
    }
    if (Array.isArray(ce?.otherEvents)) {
      for (const o of ce.otherEvents) {
        events.push({
          type: 'other',
          symbol,
          date: o.date ? new Date(o.date * 1000).toISOString() : null,
          description: o.description || null,
        });
      }
    }
    const data = { symbol, events, fetchedAt: new Date().toISOString() };
    cache.set(key, data, 600);
    return data;
  } catch (err) {
    console.error(`[yahoo] calendar error for ${symbol}:`, err.message);
    return { symbol, events: [], fetchedAt: new Date().toISOString() };
  }
}

async function fetchHistory(symbol, range = '6mo', interval = '1d') {
  try {
    const end = new Date();
    const start = new Date();
    const rangeMap = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825 };
    const days = rangeMap[range] || 180;
    start.setDate(end.getDate() - days);
    const result = await yahooFinance.historical(symbol, {
      period1: start,
      period2: end,
      interval,
    });
    return (result || []).map(r => ({
      date: r.date.toISOString().slice(0, 10),
      open: safeNumber(r.open),
      high: safeNumber(r.high),
      low: safeNumber(r.low),
      close: safeNumber(r.close),
      volume: safeNumber(r.volume),
      adjClose: safeNumber(r.adjclose),
    }));
  } catch (err) {
    console.error(`[yahoo] history error for ${symbol}:`, err.message);
    return [];
  }
}

async function searchSymbol(query) {
  try {
    const r = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
    return (r.quotes || []).map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange,
      exchangeDisplay: q.exchDisp,
      type: q.quoteType,
      typeDisplay: q.typeDisp,
    }));
  } catch (err) {
    console.error(`[yahoo] search error for ${query}:`, err.message);
    return [];
  }
}

function clearCache() { cache.flushAll(); }

module.exports = {
  fetchQuote,
  fetchFundamentals,
  fetchNews,
  fetchCalendar,
  fetchHistory,
  searchSymbol,
  clearCache,
};
