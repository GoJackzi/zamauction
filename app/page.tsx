'use client';

import { useEffect, useState, useCallback } from 'react';
import PublicAuctionTable from '@/components/PublicAuctionTable';
import StrategyCalculator from '@/components/StrategyCalculator';
import { RefreshCw } from 'lucide-react';

interface UserStats {
  address: string;
  totalDeposited: number;
  totalUnwrapped: number;
  netShielded: number;
  bidCount: number;
  avgBidPrice: number;
  estQty: number;
}

interface SummaryStats {
  totalShielded: number;
  totalUnshielded: number;
  tsv: number;
  totalBids: number;
  canceledBids: number;
}

export default function Home() {
  const [data, setData] = useState<UserStats[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.users || []);
      setSummary(json.summary || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => fetchData(true);

  return (
    <main className="min-h-screen p-8 md:p-12">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <img
              src="https://auction.zama.org/assets/logo-header.svg"
              alt="Zama"
              className="h-8"
              style={{ filter: 'brightness(0) saturate(100%) invert(88%) sepia(61%) saturate(497%) hue-rotate(358deg) brightness(103%) contrast(93%)' }}
            />
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-gray-500 font-mono">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-white text-sm font-mono rounded disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Public Auction
            </h1>
            <p className="text-sm text-gray-500">
              *Avg Bid $ and Est $ZAMA are estimates assuming each address bids their full Net cUSDT at their average bid price.
            </p>
          </div>
        </header>

        {/* Strategy Section - pass data as prop */}
        <StrategyCalculator data={data} loading={loading} />

        {/* Main Table - pass data as prop */}
        <PublicAuctionTable
          data={data}
          summary={summary}
          loading={loading}
        />

        {/* Footer */}
        <footer className="text-center text-xs text-gray-600">
          Data source: Etherscan API
        </footer>

      </div>
    </main>
  );
}
