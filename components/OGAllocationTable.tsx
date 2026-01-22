'use client';

import { useEffect, useState } from 'react';
import { getOGAllocationData, OGUser } from '@/utils/etherscan';
import { Loader2, ArrowUpRight, Check, X } from 'lucide-react';

export default function OGAllocationTable() {
    const [data, setData] = useState<OGUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const res = await getOGAllocationData();
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
                        <th className="px-6 py-4 text-center">OG NFTs</th>
                        <th className="px-6 py-4 text-right">Max Allocation</th>
                        <th className="px-6 py-4 text-right">Total Spent</th>
                        <th className="px-6 py-4 w-48">% Filled</th>
                        <th className="px-6 py-4 text-center">Claimed</th>
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
                            <td className="px-6 py-4 text-center text-white">{user.nftCount}</td>
                            <td className="px-6 py-4 text-right">${user.maxAllocation.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-medium text-white">
                                ${user.totalSpent.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 to-[#f5e147] rounded-full"
                                            style={{ width: `${Math.min(user.percentFilled, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs w-12 text-right">
                                        {user.percentFilled.toFixed(0)}%
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {user.zamaClaimed ? (
                                    <Check className="h-5 w-5 text-green-400 mx-auto" />
                                ) : (
                                    <X className="h-5 w-5 text-gray-600 mx-auto" />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
