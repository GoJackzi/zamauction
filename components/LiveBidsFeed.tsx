'use client';

import { useEffect, useState } from 'react';
import { getLiveBids, LiveBid } from '@/utils/etherscan';
import { Loader2, ArrowUpRight, Activity } from 'lucide-react';

export default function LiveBidsFeed() {
    const [bids, setBids] = useState<LiveBid[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const res = await getLiveBids(25);
            setBids(res);
            setLoading(false);
        }
        load();

        // Poll every 30 seconds for new bids
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#f5e147]" />
        </div>
    );

    return (
        <div className="space-y-3">
            {bids.map((bid, i) => (
                <div
                    key={bid.txHash + i}
                    className="glass-card flex items-center justify-between gap-4 !p-4"
                >
                    <div className="flex items-center gap-3">
                        <Activity className="h-4 w-4 text-green-400" />
                        <a
                            href={`https://etherscan.io/address/${bid.bidder}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-white hover:text-[#f5e147] flex items-center gap-1"
                        >
                            {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
                            <ArrowUpRight className="h-3 w-3 opacity-50" />
                        </a>
                    </div>

                    <div className="flex items-center gap-6">
                        <span className="text-xl font-bold text-white">
                            ${bid.price.toFixed(4)}
                        </span>
                        <span className="text-xs text-gray-500">
                            {new Date(bid.timestamp).toLocaleTimeString()}
                        </span>
                        <a
                            href={`https://etherscan.io/tx/${bid.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gray-500 hover:text-[#f5e147]"
                        >
                            tx ↗
                        </a>
                    </div>
                </div>
            ))}

            {bids.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No active bids yet
                </div>
            )}
        </div>
    );
}
