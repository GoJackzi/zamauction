'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, ArrowUpRight, ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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

interface PublicAuctionTableProps {
    data: UserStats[];
    summary: SummaryStats | null;
    loading: boolean;
}

type SortKey = keyof UserStats;
type SortDir = 'asc' | 'desc';

const ROWS_PER_PAGE = 15;

const columns: { key: SortKey; label: string; align: 'left' | 'right' | 'center'; tooltip?: string }[] = [
    { key: 'address', label: 'USER', align: 'left' },
    { key: 'totalDeposited', label: 'USDT SHIELDED', align: 'right' },
    { key: 'totalUnwrapped', label: 'USDT UNSHIELDED', align: 'right' },
    { key: 'netShielded', label: 'SHIELDED (CUSDT)', align: 'right' },
    { key: 'bidCount', label: 'TOTAL BIDS', align: 'center' },
    { key: 'avgBidPrice', label: 'AVG BID $', align: 'right', tooltip: 'Assuming each address bids their full cUSDT' },
    { key: 'estQty', label: 'EST $ZAMA', align: 'right' },
];

export default function PublicAuctionTable({ data, summary, loading }: PublicAuctionTableProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('netShielded');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const filtered = useMemo(() => {
        let result = data;
        if (search.trim()) result = result.filter(u => u.address.toLowerCase().includes(search.toLowerCase()));
        return [...result].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
            return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
    }, [data, search, sortKey, sortDir]);

    useEffect(() => { setPage(1); }, [search, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
    const startIdx = (page - 1) * ROWS_PER_PAGE;
    const pageData = filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
        return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#FFE600]" /> : <ArrowDown className="h-3 w-3 text-[#FFE600]" />;
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#FFE600]" /></div>;
    if (error) return <div className="flex h-64 items-center justify-center text-red-500 font-mono text-sm">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-[#FFE600] transition-colors" />
                    <input type="text" placeholder="Search by address..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-gray-600 focus:outline-none focus:border-[#FFE600] transition-colors font-mono text-sm" />
                </div>
            </div>

            {/* Summary Stats Box */}
            {summary && (
                <div className="border border-[#333] bg-[#0a0a0a] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-mono">Public Auction Summary</div>
                        <button onClick={refreshSummary} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#FFE600] transition-colors" title="Refresh data">
                            <RefreshCw className={`h-3 w-3 ${summaryRefreshing ? 'animate-spin text-[#FFE600]' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-5 gap-6">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">USDT Shielded</div>
                            <div className="text-lg font-mono text-white">{summary.totalShielded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">USDT Unshielded</div>
                            <div className="text-lg font-mono text-white">{summary.totalUnshielded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Value Shielded (TVS)</div>
                            <div className="text-lg font-mono text-[#FFE600]">{summary.tsv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 cursor-help" title="Including canceled bids">
                                Total Bids <span className="text-[#FFE600]">ⓘ</span>
                            </div>
                            <div className="text-lg font-mono text-white">{(summary.totalBids - summary.canceledBids).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Canceled Bids</div>
                            <div className="text-lg font-mono text-red-500">{summary.canceledBids.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto border-t border-[#333]">
                <table className="w-full text-left text-sm text-gray-400 font-mono">
                    <thead className="text-xs uppercase text-gray-500 tracking-wider">
                        <tr>
                            {columns.map(col => (
                                <th key={col.key} className={`px-4 py-4 cursor-pointer hover:text-[#FFE600] transition-colors select-none text-${col.align} border-b border-[#333]`} onClick={() => handleSort(col.key)} title={col.tooltip}>
                                    <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                        {col.label}{col.tooltip && <span className="text-[#FFE600] cursor-help">ⓘ</span>} <SortIcon col={col.key} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                        {pageData.map(user => (
                            <tr key={user.address} className="hover:bg-[#111] transition-colors group">
                                <td className="px-4 py-4 text-white">
                                    <a href={`https://etherscan.io/address/${user.address}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#FFE600] transition-colors">
                                        <span className="opacity-70 group-hover:opacity-100">{user.address.slice(0, 8)}...{user.address.slice(-6)}</span>
                                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                </td>
                                <td className="px-4 py-4 text-right">{user.totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td className="px-4 py-4 text-right text-gray-500">{user.totalUnwrapped > 0 ? user.totalUnwrapped.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}</td>
                                <td className="px-4 py-4 text-right font-medium text-white">{user.netShielded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td className="px-4 py-4 text-center">{user.bidCount > 0 ? user.bidCount : '-'}</td>
                                <td className="px-4 py-4 text-right">{user.avgBidPrice > 0 ? user.avgBidPrice.toFixed(3) : '-'}</td>
                                <td className="px-4 py-4 text-right text-[#FFE600]">{user.estQty > 0 ? user.estQty.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</td>
                            </tr>
                        ))}
                        {pageData.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-600 font-mono">No results found</td></tr>}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-gray-500 border-t border-[#333] pt-4">
                <span>{filtered.length > 0 ? `SHOWING ${startIdx + 1}-${Math.min(startIdx + ROWS_PER_PAGE, filtered.length)} OF ${filtered.length}` : '0 RESULTS'}</span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1 bg-[#111] hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-[#111] transition-colors text-white">
                        <ChevronLeft className="h-3 w-3" /> PREV
                    </button>
                    <span className="px-3 py-1 text-gray-600">{totalPages > 0 ? `${page} / ${totalPages}` : '-'}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 px-3 py-1 bg-[#111] hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-[#111] transition-colors text-white">
                        NEXT <ChevronRight className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
