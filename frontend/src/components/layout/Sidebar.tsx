import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="hidden md:block">
      <div className="space-y-4 p-4">
        <nav className="space-y-2 flex flex-col">
          <Link href="/" className="text-gray-400 hover:text-gray-200 transition-colors">
            Overview
          </Link>
          <Link href="/watchlist" className="text-gray-400 hover:text-gray-200 transition-colors">
            Watchlist
          </Link>
          <Link href="/screener" className="text-gray-400 hover:text-gray-200 transition-colors">
            Screener
          </Link>
        </nav>
      </div>
    </aside>
  );
}
