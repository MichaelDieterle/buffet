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
  assert.equal(ind.sma_20[19], 109.5);
  assert.equal(ind.sma_20[18], null);
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

test('provider Stooq candidates normalize supported Yahoo symbols', () => {
  const { _internals } = require('../src/services/provider');
  assert.deepEqual(_internals.stooqCandidates('AAPL'), ['aapl.us']);
  assert.deepEqual(_internals.stooqCandidates('SAP.DE'), ['sap.de']);
  assert.deepEqual(_internals.stooqCandidates('BP.L'), ['bp.l', 'bp.uk']);
  assert.deepEqual(_internals.stooqCandidates('AIR.PA'), ['air.pa']);
  assert.deepEqual(_internals.stooqCandidates('^GSPC'), []);
  assert.deepEqual(_internals.stooqCandidates(''), []);
  assert.deepEqual(_internals.stooqCandidates(null), []);
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
