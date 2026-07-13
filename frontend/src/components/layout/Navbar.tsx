import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Navigate to stock page
      window.location.href = `/stock/${query.trim().toUpperCase()}`;
    }
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <span className="text-xl font-semibold text-gray-100">Buffet</span>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <form onSubmit={handleSubmit} className="flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter ticker..."
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="ml-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded">
                Search
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
