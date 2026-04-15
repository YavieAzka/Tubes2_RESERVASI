"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [selector, setSelector] = useState("h1");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, selector }),
      });
      
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal melakukan scraping");
      }
      
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-800 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-3xl font-extrabold mb-2 text-indigo-600">DOM Parser & Scraper</h1>
        <p className="text-gray-500 mb-6">Tubes 2 Strategi Algoritma: Engine Parser & CSS Matcher</p>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1 text-gray-700">URL Website</label>
            <input 
              className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="https://google.com"
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1 text-gray-700">CSS Selector (Opsional)</label>
            <input 
              className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" 
              value={selector} 
              onChange={(e) => setSelector(e.target.value)} 
              placeholder="Contoh: div.container > .item"
            />
          </div>
          
          <div className="flex items-end">
            <button 
              onClick={handleScrape} 
              disabled={loading}
              className={`p-3 rounded-lg font-bold text-white transition-colors w-full md:w-auto px-8 ${
                loading ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-md"
              }`}
            >
              {loading ? "Mencari..." : "Scrape & Parse!"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
            <p className="text-red-700 font-medium"><strong>Error:</strong> {error}</p>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-3 border-b pb-2">Hasil ({data ? data.length : 0} elemen)</h2>
          <div className="bg-gray-900 p-5 rounded-lg text-green-400 font-mono text-sm shadow-inner min-h-[200px] max-h-[500px] overflow-auto">
            {loading ? (
              <span className="text-gray-400 animate-pulse">Memproses algoritma parsing dan traversing tree...</span>
            ) : data ? (
              <pre>{JSON.stringify(data, null, 2)}</pre>
            ) : (
              <span className="text-gray-500">Hasil ekstraksi web akan muncul di sini...</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
