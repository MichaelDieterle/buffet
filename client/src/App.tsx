import { useEffect, useState } from "react";
import api, {
  fetchQuote,
  fetchFundamentals,
  fetchNews,
  fetchCalendar,
  refreshStock,
  searchYahoo,
  createStock,
  exportCsvUrl,
} from "./api";

type Stock = { id: number; symbol: string; name: string; sector?: string; industry?: string };

type Quote = {
  price: number | null; change: number | null; changePercent: number | null;
  dayHigh: number | null; dayLow: number | null; yearHigh: number | null; yearLow: number | null;
  volume: number | null; marketCap: number | null; previousClose: number | null;
  currency: string; exchangeName?: string; marketState?: string; timestamp?: string;
} | null;

type Fundamentals = {
  peRatio: number | null; forwardPe: number | null; pegRatio: number | null;
  pbRatio: number | null; psRatio: number | null; eps: number | null; forwardEps: number | null;
  dividendRate: number | null; dividendYield: number | null; payoutRatio: number | null;
  beta: number | null; marketCap: number | null;
  fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null; twoHundredDayAverage: number | null;
  revenue: number | null; revenuePerShare: number | null;
  earningsGrowth: number | null; revenueGrowth: number | null;
  profitMargins: number | null; operatingMargins: number | null; grossMargins: number | null;
  freeCashflow: number | null; operatingCashflow: number | null;
  totalCash: number | null; totalDebt: number | null;
  debtToEquity: number | null; currentRatio: number | null; quickRatio: number | null;
  roa: number | null; roc: number | null;
  targetMeanPrice: number | null; targetHighPrice: number | null; targetLowPrice: number | null;
  recommendationMean: number | null; recommendationKey: string | null; numberOfAnalystOpinions: number | null;
  sharesOutstanding: number | null; floatShares: number | null;
  heldPercentInsiders: number | null; heldPercentInstitutions: number | null;
  shortRatio: number | null; shortPercentOfFloat: number | null;
  nextEarningsDate: string | null; earningsDateLow: string | null; earningsDateHigh: string | null;
  earningsAverage: number | null; earningsLow: number | null; earningsHigh: number | null;
  revenueAverage: number | null;
  exDividendDateFromCalendar: string | null; dividendDateFromCalendar: string | null;
  businessSummary: string | null; employees: number | null; website: string | null;
  country: string | null; city: string | null; sector: string | null; industry: string | null;
  fiscalYearEnd: string | null;
} | null;

type NewsItem = {
  uuid: string; title: string; publisher: string; link: string;
  publishedAt: string; type: "company" | "geopolitics"; relatedTickers: string[]; thumbnail?: string;
};

type Calendar = { events: Array<{ type: string; date: string; dateLow?: string; dateHigh?: string; isEstimate?: boolean; earningsAverage?: number; earningsLow?: number; earningsHigh?: number; revenueAverage?: number; description?: string }> };

type SearchResult = { symbol: string; name: string; exchange: string; type: string };

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}
function big(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}
function dateShort(s: string | null | undefined) {
  if (!s) return "-";
  return new Date(s).toLocaleString();
}
function relTime(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} h`;
  const t = Math.floor(h / 24);
  return `vor ${t} d`;
}

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Stock[]>("/stocks");
      setStocks(res.data);
    } catch (err: any) {
      setError("Failed to load stocks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? stocks.filter(s => s.symbol.toUpperCase().includes(search.toUpperCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
    : stocks;

  if (loading) return <div className="container">Lade...</div>;
  if (error) return <div className="container error">Fehler: {error}</div>;

  return (
    <div className="app">
      <header className="header">
        <h1>Stock Tracker</h1>
        <input
          type="text"
          placeholder="Symbol oder Name suchen"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search"
        />
        <AddStockDialog onCreated={load} />
      </header>

      <div className="layout">
        <div className="list">
          <table>
            <thead>
              <tr>
                <th>Symbol</th><th>Name</th><th>Sector</th><th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className={s.symbol === selected ? "active" : ""}>
                  <td><strong>{s.symbol}</strong></td>
                  <td>{s.name}</td>
                  <td>{s.sector || "-"}</td>
                  <td>
                    <button onClick={() => setSelected(s.symbol)}>Details</button>
                    <a className="csv" href={exportCsvUrl(s.symbol)} download>CSV</a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="empty">Keine Treffer</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="detail">
          {selected ? (
            <StockDetail symbol={selected} />
          ) : (
            <div className="placeholder">Wähle einen Stock aus der Liste</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddStockDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    if (!q) return;
    setLoading(true);
    try {
      const r = await searchYahoo(q);
      setResults(r);
    } finally { setLoading(false); }
  };

  const pick = async (r: SearchResult) => {
    await createStock({ symbol: r.symbol, name: r.name });
    setOpen(false);
    setQ("");
    setResults([]);
    onCreated();
  };

  if (!open) return <button className="add-btn" onClick={() => setOpen(true)}>+ Stock hinzufügen</button>;
  return (
    <div className="add-dialog">
      <input
        autoFocus
        placeholder="z. B. AAPL, SAP, TSLA"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
      />
      <button onClick={doSearch} disabled={loading}>Suchen</button>
      <button onClick={() => setOpen(false)}>✕</button>
      <div className="add-results">
        {results.map(r => (
          <div key={r.symbol} className="add-result" onClick={() => pick(r)}>
            <strong>{r.symbol}</strong> — {r.name} <span className="muted">{r.exchange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockDetail({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<"overview" | "fundamentals" | "news" | "calendar">("overview");
  const [quote, setQuote] = useState<Quote>(null);
  const [fund, setFund] = useState<Fundamentals>(null);
  const [news, setNews] = useState<{ all: NewsItem[]; company: NewsItem[]; geopolitics: NewsItem[] } | null>(null);
  const [cal, setCal] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, f, n, c] = await Promise.all([
        fetchQuote(symbol).catch(() => null),
        fetchFundamentals(symbol).catch(() => null),
        fetchNews(symbol).catch(() => ({ all: [], company: [], geopolitics: [] })),
        fetchCalendar(symbol).catch(() => ({ events: [] })),
      ]);
      setQuote(q);
      setFund(f);
      setNews(n);
      setCal(c);
    } catch (err: any) {
      setError(err?.message || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [symbol]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshStock(symbol);
      await load();
    } finally { setRefreshing(false); }
  };

  return (
    <div className="stock-detail">
      <div className="detail-header">
        <h2>{symbol}</h2>
        <div className="actions">
          <button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Aktualisiere..." : "Daten aktualisieren"}
          </button>
          <a className="csv" href={exportCsvUrl(symbol)} download>CSV Export</a>
        </div>
      </div>

      {loading && !quote && <div className="muted">Lade Daten...</div>}
      {error && <div className="error">{error}</div>}

      {quote && (
        <div className="quote-bar">
          <div className="price">
            {fmt(quote.price)} <span className="cur">{quote.currency}</span>
          </div>
          <div className={`change ${(quote.change ?? 0) >= 0 ? "up" : "down"}`}>
            {quote.change != null ? `${quote.change >= 0 ? "+" : ""}${fmt(quote.change)}` : "-"}
            {" "}
            {quote.changePercent != null ? `(${quote.changePercent >= 0 ? "+" : ""}${fmt(quote.changePercent)}%)` : ""}
          </div>
          <div className="meta">
            <span>Börse: {quote.exchangeName || "-"}</span>
            <span>Status: {quote.marketState || "-"}</span>
            <span>Stand: {dateShort(quote.timestamp)}</span>
          </div>
        </div>
      )}

      <div className="tabs">
        {(["overview", "fundamentals", "news", "calendar"] as const).map(t => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "overview" && "Übersicht"}
            {t === "fundamentals" && "Fundamentaldaten"}
            {t === "news" && `News (${(news?.company.length || 0) + (news?.geopolitics.length || 0)})`}
            {t === "calendar" && `Termine (${cal?.events.length || 0})`}
          </button>
        ))}
      </div>

      {tab === "overview" && quote && (
        <div className="grid">
          <Card title="Tag">{kv("Hoch", fmt(quote.dayHigh))}{kv("Tief", fmt(quote.dayLow))}{kv("Volumen", big(quote.volume))}{kv("Vortag", fmt(quote.previousClose))}</Card>
          <Card title="52-Wochen">{kv("Hoch", fmt(quote.yearHigh))}{kv("Tief", fmt(quote.yearLow))}</Card>
          <Card title="Marktkapitalisierung">{kv("Market Cap", big(quote.marketCap))}</Card>
          {fund && (
            <Card title="Bewertung">
              {kv("KGV (PE)", fmt(fund.peRatio))}
              {kv("Forward PE", fmt(fund.forwardPe))}
              {kv("PEG", fmt(fund.pegRatio))}
              {kv("KUV (PS)", fmt(fund.psRatio))}
              {kv("KUV (PB)", fmt(fund.pbRatio))}
              {kv("EPS", fmt(fund.eps))}
              {kv("Forward EPS", fmt(fund.forwardEps))}
            </Card>
          )}
        </div>
      )}

      {tab === "fundamentals" && fund && (
        <div className="grid">
          <Card title="Bewertung">
            {kv("KGV (trailing)", fmt(fund.peRatio))}
            {kv("KGV (forward)", fmt(fund.forwardPe))}
            {kv("PEG", fmt(fund.pegRatio))}
            {kv("KBV (PB)", fmt(fund.pbRatio))}
            {kv("KUV (PS)", fmt(fund.psRatio))}
            {kv("EPS", fmt(fund.eps))}
            {kv("Forward EPS", fmt(fund.forwardEps))}
            {kv("Beta", fmt(fund.beta))}
          </Card>
          <Card title="Dividende">
            {kv("Rate", fmt(fund.dividendRate, 4))}
            {kv("Yield", pct(fund.dividendYield))}
            {kv("Payout Ratio", pct(fund.payoutRatio))}
            {kv("Ex-Dividend", dateShort(fund.exDividendDateFromCalendar))}
            {kv("Zahldatum", dateShort(fund.dividendDateFromCalendar))}
          </Card>
          <Card title="Gewinn & Marge">
            {kv("Umsatz", big(fund.revenue))}
            {kv("Umsatz/Aktie", fmt(fund.revenuePerShare))}
            {kv("Umsatzwachstum", pct(fund.revenueGrowth))}
            {kv("Gewinnwachstum", pct(fund.earningsGrowth))}
            {kv("Bruttomarge", pct(fund.grossMargins))}
            {kv("Operative Marge", pct(fund.operatingMargins))}
            {kv("Nettomarge", pct(fund.profitMargins))}
          </Card>
          <Card title="Cashflow & Bilanz">
            {kv("Free Cashflow", big(fund.freeCashflow))}
            {kv("Operativer Cashflow", big(fund.operatingCashflow))}
            {kv("Cash", big(fund.totalCash))}
            {kv("Schulden", big(fund.totalDebt))}
            {kv("Debt/Equity", fmt(fund.debtToEquity))}
            {kv("Current Ratio", fmt(fund.currentRatio))}
            {kv("Quick Ratio", fmt(fund.quickRatio))}
            {kv("ROA", pct(fund.roa))}
            {kv("ROE", pct(fund.roc))}
          </Card>
          <Card title="Analysten">
            {kv("Kursziel (Mittel)", fmt(fund.targetMeanPrice))}
            {kv("Kursziel Hoch", fmt(fund.targetHighPrice))}
            {kv("Kursziel Tief", fmt(fund.targetLowPrice))}
            {kv("Empfehlung", fund.recommendationKey || "-")}
            {kv("Anzahl Analysten", fund.numberOfAnalystOpinions ?? "-")}
          </Card>
          <Card title="Aktienstruktur">
            {kv("Outstanding", big(fund.sharesOutstanding))}
            {kv("Free Float", big(fund.floatShares))}
            {kv("Insider %", pct(fund.heldPercentInsiders))}
            {kv("Institutionen %", pct(fund.heldPercentInstitutions))}
            {kv("Short Ratio", fmt(fund.shortRatio))}
            {kv("Short % Float", pct(fund.shortPercentOfFloat))}
          </Card>
          {fund.businessSummary && (
            <Card title="Über das Unternehmen" wide>
              <p className="summary">{fund.businessSummary}</p>
              <div className="muted">
                {fund.website && <a href={fund.website} target="_blank" rel="noreferrer">Website</a>}{" "}
                {fund.country && `· ${fund.country} ${fund.city ? `(${fund.city})` : ""}`}{" "}
                {fund.employees && `· ${fund.employees.toLocaleString()} Mitarbeiter`}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "news" && news && (
        <div className="news">
          <h3>Geopolitische Nachrichten</h3>
          {news.geopolitics.length === 0 && <div className="muted">Keine</div>}
          {news.geopolitics.map(n => <NewsCard key={n.uuid} item={n} />)}
          <h3>Unternehmensnachrichten</h3>
          {news.company.length === 0 && <div className="muted">Keine</div>}
          {news.company.map(n => <NewsCard key={n.uuid} item={n} />)}
        </div>
      )}

      {tab === "calendar" && cal && (
        <div className="calendar">
          {cal.events.length === 0 && <div className="muted">Keine Termine</div>}
          {cal.events.map((e, i) => (
            <div key={i} className="event">
              <div className="event-type">{e.type}</div>
              <div className="event-date">{dateShort(e.date)}</div>
              {e.earningsAverage != null && (
                <div className="event-extra">EPS-Schätzung: {fmt(e.earningsAverage)} (low {fmt(e.earningsLow)} / high {fmt(e.earningsHigh)})</div>
              )}
              {e.revenueAverage != null && (
                <div className="event-extra">Umsatz-Schätzung: {big(e.revenueAverage)}</div>
              )}
              {e.description && <div className="event-extra">{e.description}</div>}
              {e.isEstimate && <div className="event-tag">Schätzung</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function kv(k: string, v: any) {
  return <div className="kv"><span>{k}</span><strong>{v}</strong></div>;
}
function Card({ title, children, wide }: { title: string; children: any; wide?: boolean }) {
  return <div className={`card ${wide ? "wide" : ""}`}><h4>{title}</h4>{children}</div>;
}
function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a className={`news-card ${item.type}`} href={item.link} target="_blank" rel="noreferrer">
      {item.thumbnail && <img src={item.thumbnail} alt="" />}
      <div className="news-body">
        <div className="news-title">{item.title}</div>
        <div className="news-meta">
          <span className={`tag tag-${item.type}`}>{item.type === "geopolitics" ? "Geopolitik" : "Unternehmen"}</span>
          <span>{item.publisher}</span>
          <span className="muted">{relTime(item.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

export default App;
