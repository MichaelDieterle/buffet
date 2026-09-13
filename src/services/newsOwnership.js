const crypto = require('crypto');

function normalizeTicker(ticker) {
  return typeof ticker === 'string' ? ticker.trim().toUpperCase().split('.')[0] : '';
}

function articleMatchesStock(article, symbol) {
  const tickers = Array.isArray(article?.relatedTickers) ? article.relatedTickers : [];
  if (!tickers.length) return true;
  const wanted = normalizeTicker(symbol);
  return tickers.some(t => normalizeTicker(t) === wanted);
}

function canonicalNewsUuid(article) {
  if (article?.uuid) return String(article.uuid);
  const identity = `${article?.link || ''}|${article?.title || ''}|${article?.publishedAt || ''}`;
  return `generated-${crypto.createHash('sha256').update(identity).digest('hex')}`;
}

async function saveNewsForStock(News, Stock, stock, article) {
  if (!articleMatchesStock(article, stock.symbol)) return 'skipped-unrelated';
  const uuid = canonicalNewsUuid(article);
  const values = {
    stockId: stock.id, uuid, title: article.title, publisher: article.publisher,
    link: article.link, publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
    type: article.type, thumbnail: article.thumbnail, relatedTickers: article.relatedTickers || [],
  };
  const existing = await News.findOne({
    where: { uuid },
    include: [{ model: Stock, as: 'stock', attributes: ['id', 'symbol'] }],
  });
  if (!existing) { await News.create(values); return 'created'; }
  if (existing.stockId === stock.id) {
    await existing.update({ title: values.title, publisher: values.publisher, link: values.link,
      publishedAt: values.publishedAt, type: values.type, thumbnail: values.thumbnail,
      relatedTickers: values.relatedTickers });
    return 'updated';
  }
  const tickers = Array.isArray(article.relatedTickers) ? article.relatedTickers : [];
  const existingIsAlsoRelated = existing.stock?.symbol && tickers.length > 0 &&
    tickers.some(t => normalizeTicker(t) === normalizeTicker(existing.stock.symbol));
  if (tickers.length > 0 && !existingIsAlsoRelated) {
    await existing.update(values);
    return 'reassigned';
  }
  return 'kept-existing-owner';
}

module.exports = { normalizeTicker, articleMatchesStock, canonicalNewsUuid, saveNewsForStock };
