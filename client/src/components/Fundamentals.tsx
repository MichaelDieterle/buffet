import React from 'react';

interface FundamentalsProps {
  fund: any; // replace with proper type if available
}

export const Fundamentals: React.FC<FundamentalsProps> = ({ fund }) => {
  if (!fund) return <div>Loading fundamentals...</div>;

  return (
    <div className="grid">
      <div className="card">
        <h4>Bewertung</h4>
        <div className="kv"><span>KGV (PE)</span><strong>{fund.peRatio ?? '-'}</strong></div>
        <div className="kv"><span>Forward PE</span><strong>{fund.forwardPe ?? '-'}</strong></div>
        <div className="kv"><span>PEG</span><strong>{fund.pegRatio ?? '-'}</strong></div>
        <div className="kv"><span>KUV (PS)</span><strong>{fund.psRatio ?? '-'}</strong></div>
        <div className="kv"><span>KBV (PB)</span><strong>{fund.pbRatio ?? '-'}</strong></div>
        <div className="kv"><span>EPS</span><strong>{fund.eps ?? '-'}</strong></div>
        <div className="kv"><span>Forward EPS</span><strong>{fund.forwardEps ?? '-'}</strong></div>
      </div>

      <div className="card">
        <h4>Dividende</h4>
        <div className="kv"><span>Rate</span><strong>{fund.dividendRate?.toFixed(4) ?? '-'}</strong></div>
        <div className="kv"><span>Yield</span><strong>{(fund.dividendYield != null ? (fund.dividendYield * 100).toFixed(2) : '-')}%</strong></div>
        <div className="kv"><span>Payout Ratio</span><strong>{(fund.payoutRatio != null ? (fund.payoutRatio * 100).toFixed(2) : '-')}%</strong></div>
        <div className="kv"><span>Ex-Dividend</span><strong>{fund.exDividendDateFromCalendar ?? '-'}</strong></div>
        <div className="kv"><span>Zahldatum</span><strong>{fund.dividendDateFromCalendar ?? '-'}</strong></div>
      </div>

      <div className="card">
        <h4>Gewinn & Marge</h4>
        <div className="kv"><span>Umsatz</span><strong>{formatLarge(fund.revenue)}</strong></div>
        <div className="kv"><span>Umsatz/Aktie</span><strong>{fund.revenuePerShare ?? '-'}</strong></div>
        <div className="kv"><span>Umsatzwachstum</span><strong>{formatPercent(fund.revenueGrowth)}</strong></div>
        <div className="kv"><span>Gewinnwachstum</span><strong>{formatPercent(fund.earningsGrowth)}</strong></div>
        <div className="kv"><span>Bruttomarge</span><strong>{formatPercent(fund.grossMargins)}</strong></div>
        <div className="kv"><span>Operative Marge</span><strong>{formatPercent(fund.operatingMargins)}</strong></div>
        <div className="kv"><span>Nettomarge</span><strong>{formatPercent(fund.profitMargins)}</strong></div>
      </div>

      <div className="card">
        <h4>Cashflow & Bilanz</h4>
        <div className="kv"><span>Free Cashflow</span><strong>{formatLarge(fund.freeCashflow)}</strong></div>
        <div className="kv"><span>Operativer Cashflow</span><strong>{formatLarge(fund.operatingCashflow)}</strong></div>
        <div className="kv"><span>Cash</span><strong>{formatLarge(fund.totalCash)}</strong></div>
        <div className="kv"><span>Schulden</span><strong>{formatLarge(fund.totalDebt)}</strong></div>
        <div className="kv"><span>Debt/Equity</span><strong>{fund.debtToEquity ?? '-'}</strong></div>
        <div className="kv"><span>Current Ratio</span><strong>{fund.currentRatio ?? '-'}</strong></div>
        <div className="kv"><span>Quick Ratio</span><strong>{fund.quickRatio ?? '-'}</strong></div>
        <div className="kv"><span>ROA</span><strong>{formatPercent(fund.roa)}</strong></div>
        <div className="kv"><span>ROE</span><strong>{formatPercent(fund.roc)}</strong></div>
      </div>

      <div className="card">
        <h4>Analysten</h4>
        <div className="kv"><span>Kursziel (Mittel)</span><strong>{fund.targetMeanPrice ?? '-'}</strong></div>
        <div className="kv"><span>Kursziel Hoch</span><strong>{fund.targetHighPrice ?? '-'}</strong></div>
        <div className="kv"><span>Kursziel Tief</span><strong>{fund.targetLowPrice ?? '-'}</strong></div>
        <div className="kv"><span>Empfehlung</span><strong>{fund.recommendationKey ?? '-'}</strong></div>
        <div className="kv"><span>Anzahl Analysten</span><strong>{fund.numberOfAnalystOpinions ?? '-'}</strong></div>
      </div>

      <div className="card">
        <h4>Finanzkennzahlen</h4>
        <div className="kv"><span>Umsatzwachstum</span><strong>{fund.revenueGrowth?.toFixed(2) ?? "-"}</strong></div>
        <div className="kv"><span>Gewinnwachstum</span><strong>{fund.earningsGrowth?.toFixed(2) ?? "-"}</strong></div>
        <div className="kv"><span>EBIT-Marge</span><strong>{(fund.ebitMargin != null ? (fund.ebitMargin * 100).toFixed(2) : "-")}%</strong></div>
        <div className="kv"><span>Gewinnmarge</span><strong>{(fund.profitMargin != null ? (fund.profitMargin * 100).toFixed(2) : "-")}%</strong></div>
        <div className="kv"><span>Verschuldungsgrad</span><strong>{fund.debtToEquity?.toFixed(2) ?? "-"}</strong></div>
        <div className="kv"><span>Liquidit�tsratio</span><strong>{fund.currentRatio?.toFixed(2) ?? "-"}</strong></div>
        <div className="kv"><span>ROE</span><strong>{(fund.roe != null ? (fund.roe * 100).toFixed(2) : "-")}%</strong></div>
        <div className="kv"><span>ROI</span><strong>{(fund.roi != null ? (fund.roi * 100).toFixed(2) : "-")}%</strong></div>
      </div>

      {fund.businessSummary && (
        <div className="card wide">
          <h4>�ber das Unternehmen</h4>
          <p className="summary">{fund.businessSummary}</p>
          <div className="muted">
            {fund.website && <a href={fund.website} target="_blank" rel="noreferrer">Website</a>}{" "}
            {fund.country && `� ${fund.country} ${fund.city ? `(${fund.city})` : ''}`}{" "}
            {fund.employees && `� ${fund.employees.toLocaleString()} Mitarbeiter`}
          </div>
        </div>
      )}
    </div>
  );
};

function formatLarge(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return '-';
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return String(num);
}

function formatPercent(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return '-';
  return (num * 100).toFixed(2) + '%';
}

