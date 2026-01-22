'use client';

import { useEffect, useState } from 'react';
import { getConfidentailData, UserStats } from '@/utils/etherscan';
import { Loader2, ArrowUpRight } from 'lucide-react';

export default function ConfidentialTable() {
    const [data, setData] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const res = await getConfidentailData();
            setData(res);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#f5e147]" />
        </div>
    );

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-1">
            <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-white/5 text-xs uppercase text-gray-200">
                    <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4 text-right">Net Shielded</th>
                        <th className="px-6 py-4 text-right">Deposits</th>
                        <th className="px-6 py-4 text-center">Bids</th>
                        <th className="px-6 py-4 text-right">Avg Bid Price</th>
                        <th className="px-6 py-4 text-right">Est. Qty</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {data.map((user) => (
                        <tr key={user.address} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-mono text-white">
                                <a
                                    href={`https://etherscan.io/address/${user.address}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 hover:text-[#f5e147]"
                                >
                                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                                    <ArrowUpRight className="h-3 w-3 opacity-50" />
                                </a>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-white">
                                {user.netShielded.toLocaleString(undefined, { maximumFractionDigits: 0 })} cUSDT
                            </td>
                            <td className="px-6 py-4 text-right">
                                {user.depositCount}
                            </td>
                            <td className="px-6 py-4 text-center">
                                {user.bidCount > 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                                        {user.bidCount}
                                    </span>
                                ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {user.avgBidPrice > 0 ? `$${user.avgBidPrice.toFixed(4)}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-[#f5e147]">
                                {user.estQty > 0 ? user.estQty.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
