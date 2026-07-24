const { SMA, EMA, RSI, MACD } = require('technicalindicators');

/**
 * Calculate technical indicators for a series of closing prices.
 * @param {number[]} closes - Array of closing prices (oldest first).
 * @returns {Object} Object containing arrays for each indicator (same length as input).
 */
function computeIndicators(closes) {
  const result = {};

  // Simple Moving Average (SMA) 20 and 50
  if (closes.length >= 20) {
    const sma20 = new SMA({ period: 20, values: closes });
    result.sma_20 = Array.from({ length: closes.length }, (_, i) =>
      i < 19 ? null : sma20.result[i - 19] ?? null
    );
  } else {
    result.sma_20 = Array(closes.length).fill(null);
  }
  if (closes.length >= 50) {
    const sma50 = new SMA({ period: 50, values: closes });
    result.sma_50 = Array.from({ length: closes.length }, (_, i) =>
      i < 49 ? null : sma50.result[i - 49] ?? null
    );
  } else {
    result.sma_50 = Array(closes.length).fill(null);
  }

  // Exponential Moving Average (EMA) 12 and 26
  if (closes.length >= 12) {
    const ema12 = new EMA({ period: 12, values: closes });
    result.ema_12 = Array.from({ length: closes.length }, (_, i) =>
      i < 11 ? null : ema12.result[i - 11] ?? null
    );
  } else {
    result.ema_12 = Array(closes.length).fill(null);
  }
  if (closes.length >= 26) {
    const ema26 = new EMA({ period: 26, values: closes });
    result.ema_26 = Array.from({ length: closes.length }, (_, i) =>
      i < 25 ? null : ema26.result[i - 25] ?? null
    );
  } else {
    result.ema_26 = Array(closes.length).fill(null);
  }

  // Relative Strength Index (RSI) 14
  if (closes.length >= 14) {
    const rsi = new RSI({ period: 14, values: closes });
    result.rsi = Array.from({ length: closes.length }, (_, i) =>
      i < 13 ? null : rsi.result[i - 13] ?? null
    );
  } else {
    result.rsi = Array(closes.length).fill(null);
  }

  // Moving Average Convergence Divergence (MACD) (12,26,9)
  if (closes.length >= 26) {
    const macd = new MACD({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, values: closes });
    // macd.result is an array of objects { MACD, signal, histogram }
    result.macd = Array.from({ length: closes.length }, (_, i) => {
      if (i < 25) return null;
      const idx = i - 25;
      return macd.result[idx]?.MACD ?? null;
    });
    result.macd_signal = Array.from({ length: closes.length }, (_, i) => {
      if (i < 25) return null;
      const idx = i - 25;
      return macd.result[idx]?.signal ?? null;
    });
    result.macd_hist = Array.from({ length: closes.length }, (_, i) => {
      if (i < 25) return null;
      const idx = i - 25;
      return macd.result[idx]?.histogram ?? null;
    });
  } else {
    const empty = Array(closes.length).fill(null);
    result.macd = empty;
    result.macd_signal = empty;
    result.macd_hist = empty;
  }

  return result;
}

module.exports = { computeIndicators };