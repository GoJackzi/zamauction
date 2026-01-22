'use client';

import { useEffect, useState } from 'react';

export default function VisitorCounter() {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        // Use countapi.xyz with a unique key for this dashboard
        // If the key doesn't exist, it will start from 0 or 1
        const fetchCount = async () => {
            try {
                // Using 'hit' to increment count on each load
                // Namespace: zamauction-dashboard, Key: visits
                const res = await fetch('https://api.countapi.xyz/hit/zamauction-dashboard/visits');
                if (res.ok) {
                    const data = await res.json();
                    setCount(data.value);
                }
            } catch (err) {
                console.error('Failed to fetch visitor count', err);
            }
        };

        fetchCount();
    }, []);

    if (count === null) return null;

    return (
        <div className="flex justify-center py-6 text-[10px] font-mono text-gray-700 uppercase tracking-widest border-t border-[#111] mt-12 mb-4">
            Total Visitors: <span className="text-gray-500 ml-2">{count.toLocaleString()}</span>
        </div>
    );
}
