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
  fetchIndicators,
} from "./api";
import { Fundamentals } from "./components/Fundamentals";
type Stock = { id: number; symbol: string; name: string; sector?: string; industry?: string };
type SearchResult = { symbol: string; name: string; exchange: string };
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
type NewsData = {
  all: NewsItem[];
  company: NewsItem[];
  geopolitics: NewsItem[];
};
type CalendarEvent = {
  type: string;
  date: string | null;
  dateLow?: string | null;
  dateHigh?: string | null;
  isEstimate?: boolean | null;
  earningsAverage?: number | null;
  earningsLow?: number | null;
  earningsHigh?: number | null;
  revenueAverage?: number | null;
  description?: string | null;
};
type CalendarData = {
  events: CalendarEvent[];
};
type IndicatorData = {
  sma_20: number | null;
  sma_50: number | null;
  ema_12: number | null;
  ema_26: number | null;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
};
function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  return (n * 100).toFixed(2) + "%";
}
function big(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return String(n);
}
function dateShort(s: string | null | undefined) {
  if (!s) return "-";
  return new Date(s).toLocaleString();
}
function relTime(s: string | null | undefined) {
  if (!s) return "gerade eben";
  const d = new Date(s).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h";
  const t = Math.floor(h / 24);
  return t + " d";
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
}function AddStockDialog({ onCreated }: { onCreated: () => void }) {
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
  const [tab, setTab] = useState<"overview" | "fundamentals" | "news" | "calendar" | "indicators">("overview");
  const [quote, setQuote] = useState<Quote>(null);
  const [fund, setFund] = useState<Fundamentals | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [cal, setCal] = useState<CalendarData | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, f, n, c, ind] = await Promise.all([
        fetchQuote(symbol).catch(() => null),
        fetchFundamentals(symbol).catch(() => null),
        fetchNews(symbol).catch(() => ({ all: [], company: [], geopolitics: [] })),
        fetchCalendar(symbol).catch(() => ({ events: [] })),
        fetchIndicators(symbol).catch(() => null),
      ]);
      setQuote(q);
      setFund(f);
      setNews(n);
      setCal(c);
      setIndicators(ind);
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
          <div className="change">
            {quote.change != null ? (quote.change >= 0 ? "+" : "") + fmt(quote.change) : "-"}
            {" "}
            {quote.changePercent != null ? "(" + pct(quote.changePercent) + ")" : ""}
          </div>
          <div className="meta">
            <span>Börse: {quote.exchangeName || "-"}</span>
            <span>Status: {quote.marketState || "-"}</span>
            <span>Stand: {dateShort(quote.timestamp)}</span>
          </div>
        </div>
      )}
      <div className="tabs">
        {(["overview", "fundamentals", "news", "calendar", "indicators"] as const).map(t => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "overview" ? "Übersicht" : t === "fundamentals" ? "Fundamentaldaten" : t === "news" ? "Nachrichten" : t === "calendar" ? "Termine" : "Indikatoren"}
          </button>
        ))}
      </div>
      {tab === "overview" && quote && (
        <div className="grid">
          <div className="card">
            <h4>Tag</h4>
            <div className="kv"><span>Hoch</span><strong>{fmt(quote.dayHigh)}</strong></div>
            <div className="kv"><span>Tief</span><strong>{fmt(quote.dayLow)}</strong></div>
            <div className="kv"><span>Volumen</span><strong>{big(quote.volume)}</strong></div>
            <div className="kv"><span>Vortag</span><strong>{fmt(quote.previousClose)}</strong></div>
          </div>
          <div className="card">
            <h4>52-Wochen</h4>
            <div className="kv"><span>Hoch</span><strong>{fmt(quote.yearHigh)}</strong></div>
            <div className="kv"><span>Tief</span><strong>fmt(quote.yearLow)</strong></div>
          </div>
          <div className="card">
            <h4>Marktkapitalisierung</h4>
            <div className="kv"><span>Market Cap</span><strong>big(quote.marketCap)</strong></div>
          </div>
          {fund && (
            <div className="card">
              <h4>Bewertung</h4>
              <div className="kv"><span>KGV (PE)</span><strong>fmt(fund.peRatio)</strong></div>
              <div className="kv"><span>Forward PE</span><strong>fmt(fund.forwardPe)</strong></div>
              <div className="kv"><span>PEG</span><strong>fmt(fund.pegRatio)</strong></div>
            </div>
          )}
        </div>
      )}
      {tab === "fundamentals" && fund && (
        <Fundamentals fund={fund} />
      )}
      {tab === "news" && news && (
        <News news={news} />
      )}
      {tab === "calendar" && cal && (
        <Calendar cal={cal} />
      )}
      {tab === "indicators" && indicators && (
        <div className="grid">
          <div className="card">
            <h4>Durchschnittswerte</h4>
            <div className="kv"><span>SMA 20</span><strong>fmt(indicators.sma_20)</strong></div>
            <div className="kv"><span>SMA 50</span><strong>fmt(indicators.sma_50)</strong></div>
            <div className="kv"><span>EMA 12</span><strong>fmt(indicators.ema_12)</strong></div>
            <div className="kv"><span>EMA 26</span><strong>fmt(indicators.ema_26)</strong></div>
          </div>
          <div className="card">
            <h4>Oszillatoren</h4>
            <div className="kv"><span>RSI</span><strong>fmt(indicators.rsi)</strong></div>
            <div className="kv"><span>MACD</span><strong>fmt(indicators.macd)</strong></div>
            <div className="kv"><span>MACD Signal</span><strong>fmt(indicators.macd_signal)</strong></div>
            <div className="kv"><span>MACD Hist</span><strong>fmt(indicators.macd_hist)</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a className="news-card" href={item.link} target="_blank" rel="noreferrer">
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
function News({ news }: { news: NewsData }) {
  if (!news) return <div>Loading news...</div>;
  const { company, geopolitics } = news;
  return (
    <div className="news">
      <h3>Geopolitische Nachrichten</h3>
      {geopolitics.length === 0 ? <div className="muted">Keine</div> : (
        <>
          {geopolitics.map((item: any) => (
            <NewsCard key={item.uuid} item={item} />
          ))}
        </>
      )}
      <h3>Unternehmensnachrichten</h3>
      {company.length === 0 ? <div className="muted">Keine</div> : (
        <>
          {company.map((item: any) => (
            <NewsCard key={item.uuid} item={item} />
          ))}
        </>
      )}
    </div>
  );
}
function CalendarEventCard({ event }: { event: any }) {
  const date = event.date ? new Date(event.date).toLocaleString() : "-";
  return (
    <div className="event">
      <div className="event-type">{event.type}</div>
      <div className="event-date">{date}</div>
      {event.earningsAverage != null && (
        <div className="event-extra">
          EPS-Schätzung: {formatNumber(event.earningsAverage)} (low {formatNumber(event.earningsLow)} / high {formatNumber(event.earningsHigh)})
        </div>
      )}
      {event.revenueAverage != null && (
        <div className="event-extra">
          Umsatz-Schätzung: {formatLarge(event.revenueAverage)}
        </div>
      )}
      {event.description && <div className="event-extra">{event.description}</div>}
      {event.isEstimate && <div className="event-tag">Schätzung</div>}
    </div>
  );
}
function Calendar({ cal }: { cal: CalendarData }) {
  if (!cal) return <div>Loading calendar...</div>;
  return (
    <div className="calendar">
      {cal.events.length === 0 ? <div className="muted">Keine Termine</div> : (
        <>
          {cal.events.map((event: any, index: number) => (
            <CalendarEventKey key={index} event={event} />
          ))}
        </>
      )}
    </div>
  );
}
function CalendarEventKey({ event }: { event: any }) {
  return <CalendarEventCard event={event} />;
}
function formatLarge(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return "-";
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return String(num);
}
function formatNumber(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return "-";
  return num.toString();
}
export default App;

