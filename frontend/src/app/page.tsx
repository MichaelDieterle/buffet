"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Download, Search } from "lucide-react";
import { getQuote } from "@/lib/api";

const TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "TSLA"];
type Quote = { price?: number; changePercent?: number; marketCap?: number };
const fmt = (n?: number) => n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function Home() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [query, setQuery] = useState("");
  useEffect(() => { TICKERS.forEach((ticker) => getQuote(ticker).then((data) => setQuotes((x) => ({ ...x, [ticker]: data }))).catch(() => undefined)); }, []);
  const search = (e: React.FormEvent) => { e.preventDefault(); if (query.trim()) window.location.href = `/stock/${query.trim().toUpperCase()}`; };
  return <div className="space-y-7">
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(ellipse_at_top_left,_#153454,_#0b1727_48%,_#07111f)] px-6 py-8 sm:px-9">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Your market workspace</p>
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Research markets with the signal, not the noise.</h1>
      <p className="mt-3 max-w-xl text-slate-400">Track stocks, investigate fundamentals and export every chart and article you need for your own analysis.</p>
      <form onSubmit={search} className="relative mt-6 max-w-xl"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try AAPL, NVIDIA, or BTC-USD" className="h-13 w-full rounded-xl border border-slate-600 bg-slate-950/60 pl-12 pr-28 text-sm outline-none focus:border-emerald-400" /><button className="absolute right-1.5 top-1.5 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950">Search</button></form>
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      {[['S&P 500','5,321.41','+0.47%',true],['NASDAQ','16,745.30','+0.68%',true],['DAX','18,869.36','−0.21%',false]].map(([name,value,change,up]) => <div key={String(name)} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><p className="text-sm text-slate-400">{name}</p><div className="mt-2 flex items-end justify-between"><p className="text-2xl font-semibold text-white">{value}</p><span className={`flex items-center text-sm font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{change}</span></div></div>)}
    </section>
    <section className="grid gap-6 xl:grid-cols-[1fr_320px]"><div className="rounded-xl border border-slate-800 bg-slate-900/40"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-semibold text-white">Your watchlist</h2><p className="mt-0.5 text-xs text-slate-500">Live prices from Yahoo Finance</p></div><button className="text-sm font-medium text-emerald-300">Manage</button></div><div className="divide-y divide-slate-800">{TICKERS.map((ticker) => { const q = quotes[ticker]; const up = (q?.changePercent ?? 0) >= 0; return <Link key={ticker} href={`/stock/${ticker}`} className="grid grid-cols-[1fr_auto_auto_24px] items-center gap-5 px-5 py-4 transition hover:bg-slate-800/50"><div><p className="font-semibold text-white">{ticker}</p><p className="text-xs text-slate-500">View research & exports</p></div><p className="text-sm font-medium text-white">${fmt(q?.price)}</p><p className={`text-sm ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '+' : ''}{fmt(q?.changePercent)}%</p><ChevronRight className="h-4 w-4 text-slate-600" /></Link>; })}</div></div>
      <aside className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"><div className="flex items-center gap-2"><Download className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold text-white">Research-ready exports</h2></div><p className="mt-3 text-sm leading-6 text-slate-400">Download the price history, calculated indicators, news, fundamentals, dividends and earnings for each tracked stock in one CSV.</p><p className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200">Choose a stock to view its research page and export its data.</p></aside></section>
    </div>;
}
