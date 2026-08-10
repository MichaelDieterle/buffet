"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, Star } from "lucide-react";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/stock/${query.trim().toUpperCase()}`);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#07111f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400 text-sm font-black text-slate-950">B</span>
          Buffet<span className="hidden text-slate-400 sm:inline">.finance</span>
        </Link>
        <form onSubmit={submit} className="relative hidden max-w-xl flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stocks, ETFs, or crypto" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-10 pr-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15" />
        </form>
        <nav className="ml-auto hidden items-center gap-5 text-sm text-slate-400 lg:flex"><Link href="/" className="text-white">Markets</Link><Link href="/" className="hover:text-white">Watchlist</Link><Link href="/" className="hover:text-white">Screener</Link></nav>
        <button aria-label="Notifications" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><Bell className="h-5 w-5" /></button>
        <button className="hidden items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 sm:flex"><Star className="h-4 w-4 text-amber-300" /> Watchlist</button>
      </div>
    </header>
  );
}
