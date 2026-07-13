export default function Sidebar() {
  return (
    <aside className="hidden md:block">
      <div className="space-y-4 p-4">
        <nav className="space-y-2">
          <a href="#" className="text-gray-400 hover:text-gray-200">
            Overview
          </a>
          <a href="#" className="text-gray-400 hover:text-gray-200">
            Watchlist
          </a>
          <a href="#" className="text-gray-400 hover:text-gray-200">
            Screener
          </a>
        </nav>
      </div>
    </aside>
  );
}
