const test = require('node:test');
const assert = require('node:assert/strict');

test('indicator.computeIndicators returns aligned arrays', () => {
  const indicator = require('../src/services/indicator');
  const closes = Array.from({ length: 100 }, (_, i) => 100 + i);
  const ind = indicator.computeIndicators(closes);
  assert.equal(ind.sma_20.length, 100);
  assert.equal(ind.sma_50.length, 100);
  assert.equal(ind.rsi.length, 100);
  assert.equal(ind.macd.length, 100);
  assert.equal(ind.macd_signal.length, 100);
  assert.equal(ind.macd_hist.length, 100);
  assert.equal(ind.sma_20[19], 109.5, 'SMA-20 should have a value at index 19');
  assert.equal(ind.sma_20[18], null, 'SMA-20 should be null before warm-up');
});

test('indicator.computeIndicators handles short input', () => {
  const indicator = require('../src/services/indicator');
  const ind = indicator.computeIndicators([1, 2, 3]);
  assert.equal(ind.sma_20.length, 3);
  assert.deepEqual(ind.sma_20, [null, null, null]);
  assert.deepEqual(ind.rsi, [null, null, null]);
});

test('provider loads and exposes the expected API', () => {
  const provider = require('../src/services/provider');
  for (const fn of ['fetchQuote', 'fetchFundamentals', 'fetchNews', 'fetchCalendar', 'fetchHistory', 'searchSymbol', 'clearCache']) {
    assert.equal(typeof provider[fn], 'function', `${fn} should be a function`);
  }
  assert.equal(typeof provider.name, 'string');
});

test('provider toStooqSymbol converts Yahoo symbols to Stooq format', () => {
  const { _internals } = require('../src/services/provider');
  assert.equal(_internals.toStooqSymbol('AAPL'), 'aapl.us');
  assert.equal(_internals.toStooqSymbol('SAP.DE'), 'sap.de');
  assert.equal(_internals.toStooqSymbol('BP.L'), 'bp.uk');
  assert.equal(_internals.toStooqSymbol('AIR.PA'), 'air.pa');
  assert.equal(_internals.toStooqSymbol('^GSPC'), null);
  assert.equal(_internals.toStooqSymbol(''), null);
  assert.equal(_internals.toStooqSymbol(null), null);
});

test('provider safeNumber handles junk input', () => {
  const { _internals } = require('../src/services/provider');
  assert.equal(_internals.safeNumber(12.5), 12.5);
  assert.equal(_internals.safeNumber('12.5'), 12.5);
  assert.equal(_internals.safeNumber(''), null);
  assert.equal(_internals.safeNumber('nope'), null);
  assert.equal(_internals.safeNumber(null), null);
  assert.equal(_internals.safeNumber(undefined), null);
});

test('yahooService exports the provider-facing functions', () => {
  const yahoo = require('../src/services/yahooService');
  for (const fn of ['fetchQuote', 'fetchFundamentals', 'fetchNews', 'fetchCalendar', 'fetchHistory', 'searchSymbol', 'clearCache']) {
    assert.equal(typeof yahoo[fn], 'function', `${fn} should be a function`);
  }
});
