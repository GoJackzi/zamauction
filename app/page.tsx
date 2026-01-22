import PublicAuctionTable from '@/components/PublicAuctionTable';

export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-12">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header className="space-y-4">
          <img
            src="https://auction.zama.org/assets/logo-header.svg"
            alt="Zama"
            className="h-8"
            style={{ filter: 'brightness(0) saturate(100%) invert(88%) sepia(61%) saturate(497%) hue-rotate(358deg) brightness(103%) contrast(93%)' }}
          />
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Public Auction
            </h1>
            <p className="text-sm text-gray-500">
              *Avg Bid $ and Est $ZAMA are estimates assuming each address bids their full Net cUSDT at their average bid price.
            </p>
          </div>
        </header>

        {/* Main Table */}
        <PublicAuctionTable />

        {/* Footer */}
        <footer className="text-center text-xs text-gray-600">
          Data source: Etherscan API
        </footer>

      </div>
    </main>
  );
}
