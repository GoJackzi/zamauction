'use client';

import { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';
import { Target, AlertTriangle, TrendingDown, Info } from 'lucide-react';

type User = {
    address: string;
    totalDeposited: number;
    totalUnwrapped: number;
    netShielded: number;
    avgBidPrice: number;
    bidCount: number;
};

const AUCTION_SUPPLY = 880_000_000; // 880M ZAMA

export default function StrategyCalculator() {
    const [data, setData] = useState<User[]>([]);
    const [myBid, setMyBid] = useState<string>('0.05');
    const [myBudget, setMyBudget] = useState<string>('1000');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/data')
            .then(res => res.json())
            .then(json => {
                setData(json.users || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch data", err);
                setLoading(false);
            });
    }, []);

    const curveData = useMemo(() => {
        if (!data.length) return { points: [], clearingPrice: 0, totalVolume: 0, maxPriceForChart: 1, finalizedCount: 0, totalBidders: 0 };

        // 1. Filter only valid entries (keep all bid prices)
        const filtered = [...data]
            .filter(u => u.netShielded > 0 && u.avgBidPrice > 0);

        // 2. Sort by Price Descending (Top-Fill)
        const sorted = filtered.sort((a, b) => b.avgBidPrice - a.avgBidPrice);

        let cumulativeVolume = 0;
        const points = [];
        let clearingPrice = 0;
        let foundClearing = false;

        for (const user of sorted) {
            // Volume = Balance / Price, capped at 88M ZAMA per bid
            const MAX_ZAMA_PER_BID = 88_000_000;
            const rawVol = user.netShielded / user.avgBidPrice;
            const maxBids = Math.max(1, Math.min(user.bidCount || 1, 10));
            const maxAllocation = maxBids * MAX_ZAMA_PER_BID;
            const vol = Math.min(rawVol, maxAllocation);
            cumulativeVolume += vol;

            points.push({
                price: user.avgBidPrice,
                volume: cumulativeVolume,
                address: user.address,
                individualVol: vol
            });

            if (!foundClearing && cumulativeVolume >= AUCTION_SUPPLY) {
                clearingPrice = user.avgBidPrice;
                foundClearing = true;
            }
        }

        // Calculate max price for the chart (slightly above the max point price)
        const maxPriceForChart = sorted.length > 0 ? sorted[0].avgBidPrice * 1.2 : 1;

        // Count finalized bidders (10 bids = maxed out, can't change)
        const finalizedCount = filtered.filter(u => u.bidCount >= 10).length;

        // If demand never reaches supply, clearing price is the lowest bid (everyone gets filled)
        if (!foundClearing && sorted.length > 0) {
            clearingPrice = sorted[sorted.length - 1].avgBidPrice;
        }

        return { points, clearingPrice, totalVolume: cumulativeVolume, maxPriceForChart, finalizedCount, totalBidders: filtered.length };
    }, [data]);

    const myBidNum = parseFloat(myBid) || 0;
    const isSafe = myBidNum > curveData.clearingPrice;

    // Formatting big numbers
    const formatVol = (val: number) => (val / 1_000_000).toFixed(1) + 'M';

    if (loading) return <div className="h-64 flex items-center justify-center font-mono text-gray-500">Loading Market Data...</div>;

    return (
        <div className="space-y-6 bg-[#0a0a0a] border border-[#333] p-6 rounded-lg">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                        <Target className="text-[#FFE600]" />
                        Strategy Calculator
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Pessimistic Demand Curve (Top-Fill Simulation)
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-500 font-mono">EST. CLEARING PRICE (WORST CASE)</div>
                    <div className="text-2xl font-mono text-[#FFE600] font-bold">
                        ${curveData.clearingPrice?.toFixed(4) || '0.0000'}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1">
                        {curveData.finalizedCount}/{curveData.totalBidders} finalized (10 bids)
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono mt-1">
                        Est Total: <span className="text-[#FFE600]">{formatVol(curveData.totalVolume || 0)}</span> / 880M ZAMA
                    </div>
                </div>
            </div>

            {/* Simulation Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111] p-4 rounded border border-[#222]">
                <div>
                    <label className="text-xs font-mono text-gray-500 mb-1 block">YOUR BID PRICE ($)</label>
                    <input
                        type="number"
                        step="0.001"
                        value={myBid}
                        onChange={e => setMyBid(e.target.value)}
                        className="w-full bg-black border border-[#333] text-white p-2 font-mono focus:border-[#FFE600] outline-none"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex-1 p-2 rounded border ${isSafe ? 'border-green-900 bg-green-950/20' : 'border-red-900 bg-red-950/20'}`}>
                        <div className={`text-xs font-mono mb-1 ${isSafe ? 'text-green-500' : 'text-red-500'}`}>
                            {isSafe ? 'SAFE ZONE' : 'RISKY ZONE'}
                        </div>
                        <div className="text-sm text-gray-300">
                            {isSafe
                                ? "You are above the projected clearing price."
                                : "You are below the projected clearing price. Risk of non-fill."}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curveData.points}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FFE600" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#FFE600" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                            dataKey="volume"
                            type="number"
                            domain={[0, 'auto']}
                            tickFormatter={formatVol}
                            tick={{ fill: '#666', fontSize: 10 }}
                            label={{ value: 'Cumulative Volume (ZAMA)', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
                        />
                        <YAxis
                            dataKey="price"
                            scale="log"
                            domain={[0.01, curveData.maxPriceForChart || 10]}
                            tickFormatter={(val) => `$${val >= 1 ? val.toFixed(2) : val.toFixed(3)}`}
                            tick={{ fill: '#666', fontSize: 10 }}
                            allowDataOverflow={true}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                            itemStyle={{ color: '#FFE600' }}
                            labelFormatter={(val) => `Vol: ${formatVol(val)}`}
                            formatter={(val: number) => [`$${val.toFixed(4)}`, 'Bid Price']}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#FFE600"
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                        />
                        {/* Clearing Price Line */}
                        <ReferenceLine x={AUCTION_SUPPLY} stroke="red" strokeDasharray="3 3" label={{ value: 'Supply Cap (880M)', fill: 'red', fontSize: 10, position: 'insideTopRight' }} />
                        {/* User Bid Line */}
                        <ReferenceLine y={myBidNum} stroke="#00ff00" strokeDasharray="5 5" label={{ value: 'Your Bid', fill: '#00ff00', fontSize: 10 }} />
                        {/* Zoom Brush */}
                        <Brush dataKey="volume" height={30} stroke="#666" fill="#111" tickFormatter={formatVol} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="text-[10px] text-gray-600 font-mono leading-relaxed">
                <p className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>
                        <strong>Methodology:</strong> This chart simulates a "Top-Fill" auction by sorting all depositors by their average bid price.
                        It assumes every user bids 100% of their Net Shielded balance at their average historical price.
                        The "Clearing Price" is where the cumulative demand meets the 880M ZAMA supply.
                        <br /><br />
                        <em>Disclaimer: This is a simulation using incomplete data. Actual encrypted bids may vary wildly.</em>
                    </span>
                </p>
            </div>
        </div>
    );
}
