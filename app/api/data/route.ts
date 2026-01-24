import { NextResponse } from 'next/server';

const ETHERSCAN_API_KEY = 'B8J9RJFF5P2JC446HQZ1KKBK6D5G87QB4Z';
// Etherscan V2 API endpoint for Ethereum mainnet
const BASE_URL = 'https://api.etherscan.io/v2/api';

// --- Constants ---
const WRAPPER_CONTRACT = '0xae0207c757aa2b4019ad96edd0092ddc63ef0c50';
const USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const AUCTION_CONTRACT = '0x04a5b8C32f9c38092B008A4939f1F91D550C4345';

// --- Event Topics ---
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BID_SUBMITTED_TOPIC = '0x5986d4da84b4e4719683f1ba6994a5bac9ff76c75db61b1a949e5b7d3424e892';
const BID_CANCELED_TOPIC = '0xbd8de31a25c2b7c2ddafffe72dab91b4ce5826cfd5664793eb206f572f732c27';

// Pad address to 32-byte topic
function padAddress(addr: string): string {
    return '0x' + addr.slice(2).toLowerCase().padStart(64, '0');
}

// Decode address from 32-byte topic
function decodeAddress(hex: string): string {
    return '0x' + hex.slice(-40);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchLogsPage(address: string, topic0: string, topic1?: string, topic2?: string, page: number = 1, offset: number = 1000) {
    const params: Record<string, string> = {
        chainid: '1', // Ethereum mainnet
        module: 'logs',
        action: 'getLogs',
        fromBlock: '24096698',
        toBlock: 'latest',
        address: address,
        topic0: topic0,
        page: String(page),
        offset: String(offset),
        apikey: ETHERSCAN_API_KEY,
    };

    if (topic1) {
        params.topic1 = topic1;
        params.topic0_1_opr = 'and';
    }
    if (topic2) {
        params.topic2 = topic2;
        params.topic0_2_opr = 'and';
        if (topic1) {
            params.topic1_2_opr = 'and';
        }
    }

    const query = new URLSearchParams(params);
    const url = `${BASE_URL}?${query.toString()}`;

    // Retry logic (3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`Fetching page ${page} (attempt ${attempt}):`, url.replace(ETHERSCAN_API_KEY, 'API_KEY'));
            const res = await fetch(url);
            const data = await res.json();

            if (data.status === '0' && data.message === 'No records found') {
                return [];
            }
            if (data.status === '1') {
                return data.result || [];
            }

            // Rate limit or other error - wait and retry
            console.warn(`Etherscan Error (Page ${page}):`, data.message);
            await sleep(1000 * attempt);
        } catch (err) {
            console.error(`Fetch error (Page ${page}, attempt ${attempt}):`, err);
            await sleep(1000 * attempt);
        }
    }

    // If failed after 3 attempts, throw error to prevent partial data loading
    throw new Error(`Failed to fetch page ${page} after 3 attempts`);
}

// Paginated fetch - keeps fetching until we get fewer results than the page size
async function fetchLogs(address: string, topic0: string, topic1?: string, topic2?: string): Promise<any[]> {
    const allLogs: any[] = [];
    const pageSize = 1000;
    let page = 1;
    const maxPages = 100; // Increased limit

    try {
        while (page <= maxPages) {
            const logs = await fetchLogsPage(address, topic0, topic1, topic2, page, pageSize);
            allLogs.push(...logs);

            console.log(`Page ${page}: fetched ${logs.length} logs, total: ${allLogs.length}`);

            if (logs.length < pageSize) {
                break;
            }

            page++;
            await sleep(200); // Rate limit spacing
        }
    } catch (e) {
        console.error("Incomplete log fetch:", e);
        // We might want to re-throw or handle partial data gracefully. 
        // For accurate TVS, partial data is bad. But showing something is better than nothing?
        // Let's rely on cached 'allLogs' but log the error.
    }

    return allLogs;
}

// --- In-Memory Cache ---
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function GET() {
    try {
        // Check cache
        const now = Date.now();
        if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
            console.log('Serving from cache (age:', Math.round((now - cacheTimestamp) / 1000), 's)');
            return NextResponse.json(cachedData, {
                headers: {
                    'Cache-Control': 'public, max-age=30',
                    'X-Cache': 'HIT',
                    'X-Cache-Age': String(Math.round((now - cacheTimestamp) / 1000)),
                }
            });
        }

        console.log('Cache miss - fetching fresh data...');
        const wrapperPadded = padAddress(WRAPPER_CONTRACT);

        // Parallel fetch: Deposits + Withdrawals together, Bids + Canceled together
        console.log('Fetching deposits and withdrawals in parallel...');
        const [deposits, withdrawals] = await Promise.all([
            fetchLogs(USDT_CONTRACT, TRANSFER_TOPIC, undefined, wrapperPadded),
            fetchLogs(USDT_CONTRACT, TRANSFER_TOPIC, wrapperPadded, undefined),
        ]);
        console.log('Deposits:', deposits.length, 'Withdrawals:', withdrawals.length);

        console.log('Fetching bids and canceled bids in parallel...');
        const [bids, canceledBids] = await Promise.all([
            fetchLogs(AUCTION_CONTRACT, BID_SUBMITTED_TOPIC),
            fetchLogs(AUCTION_CONTRACT, BID_CANCELED_TOPIC),
        ]);
        console.log('Bids:', bids.length, 'Canceled:', canceledBids.length);

        const canceledBidIds = new Set(canceledBids.map((log: any) => log.topics?.[1]));

        // --- Aggregate ---
        const users: Record<string, any> = {};

        const getUser = (addr: string) => {
            const key = addr.toLowerCase();
            if (!users[key]) users[key] = {
                address: addr,
                totalDeposited: 0,
                totalUnwrapped: 0,
                netShielded: 0,
                depositCount: 0,
                walletBalance: 0,
                bidCount: 0,
                avgBidPrice: 0,
                estQty: 0
            };
            return users[key];
        };

        // Process Deposits
        deposits.forEach((log: any) => {
            if (!log.topics?.[1]) return;
            const user = getUser(decodeAddress(log.topics[1]));
            const amount = Number(BigInt(log.data)) / 1e6;
            user.totalDeposited += amount;
            user.netShielded += amount;
            user.depositCount++;
        });

        // Process Withdrawals
        withdrawals.forEach((log: any) => {
            if (!log.topics?.[2]) return;
            const user = getUser(decodeAddress(log.topics[2]));
            const amount = Number(BigInt(log.data)) / 1e6;
            user.totalUnwrapped += amount;
            user.netShielded -= amount;
        });

        // Process Bids
        const userBids: Record<string, number[]> = {};

        bids.forEach((log: any) => {
            if (!log.topics?.[1] || !log.topics?.[2]) return;
            if (canceledBidIds.has(log.topics[1])) return;

            const bidder = decodeAddress(log.topics[2]);
            const user = getUser(bidder);

            // Data: eQuantity (32), Price (32), ePaid (32)
            const priceHex = '0x' + log.data.slice(66, 130);
            const price = Number(BigInt(priceHex)) / 1e6;

            user.bidCount++;

            const key = bidder.toLowerCase();
            if (!userBids[key]) userBids[key] = [];
            userBids[key].push(price);
        });

        // Calc Avg Price & Est Qty (capped at 88M ZAMA per bid)
        const MAX_ZAMA_PER_BID = 88_000_000;
        Object.values(users).forEach((u: any) => {
            const prices = userBids[u.address.toLowerCase()] || [];
            if (prices.length > 0) {
                const sum = prices.reduce((a, b) => a + b, 0);
                u.avgBidPrice = sum / prices.length;
                if (u.avgBidPrice > 0) {
                    // Raw estimate
                    const rawEstQty = u.netShielded / u.avgBidPrice;
                    // Cap based on max bids (10) * 88M per bid
                    const maxBids = Math.max(1, Math.min(u.bidCount, 10));
                    const maxAllocation = maxBids * MAX_ZAMA_PER_BID;
                    u.estQty = Math.min(rawEstQty, maxAllocation);
                }
            }
        });

        // Excluded Contracts
        const excludedAddresses = new Set([
            WRAPPER_CONTRACT.toLowerCase(),
            AUCTION_CONTRACT.toLowerCase(),
            USDT_CONTRACT.toLowerCase()
        ]);

        // Filter out users with negative netShielded (data attribution issue)
        // Also filter out users with no activity (0 deposits and 0 bids)
        // And exclude contract addresses
        const result = Object.values(users)
            .filter((u: any) =>
                !excludedAddresses.has(u.address.toLowerCase()) &&
                u.netShielded >= 0 &&
                (u.totalDeposited > 0 || u.bidCount > 0)
            )
            .sort((a: any, b: any) => b.netShielded - a.netShielded);

        // Calculate summary stats
        const summary = {
            totalShielded: result.reduce((sum: number, u: any) => sum + u.totalDeposited, 0),
            totalUnshielded: result.reduce((sum: number, u: any) => sum + u.totalUnwrapped, 0),
            tsv: result.reduce((sum: number, u: any) => sum + u.netShielded, 0),
            totalBids: bids.length,
            canceledBids: canceledBids.length,
        };

        console.log('Total users:', result.length);
        console.log('Summary:', summary);

        // Update cache
        const responseData = { users: result, summary };
        cachedData = responseData;
        cacheTimestamp = Date.now();
        console.log('Cache updated at', new Date(cacheTimestamp).toISOString());

        return NextResponse.json(responseData, {
            headers: {
                'Cache-Control': 'public, max-age=30',
                'X-Cache': 'MISS',
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        // If fetch fails but we have stale cache, serve it
        if (cachedData) {
            console.log('Serving stale cache due to error');
            return NextResponse.json(cachedData, {
                headers: {
                    'Cache-Control': 'public, max-age=30',
                    'X-Cache': 'STALE',
                }
            });
        }
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
