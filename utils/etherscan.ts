import { ethers } from 'ethers';

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'B8J9RJFF5P2JC446HQZ1KKBK6D5G87QB4Z';
const BASE_URL = 'https://api.etherscan.io/api';

// --- Constants ---
export const WRAPPER_CONTRACT = '0xae0207c757aa2b4019ad96edd0092ddc63ef0c50';
export const USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
export const AUCTION_CONTRACT = '0x04a5b8C32f9c38092B008A4939f1F91D550C4345';
export const OG_SALE_CONTRACT = '0x6716C707573988644b9b9F5a482021b3E09A68b1';
export const OG_NFT_CONTRACT = '0xb3f2ddaed136cf10d5b228ee2eff29b71c7535fc';

// --- Event Topics ---
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BID_SUBMITTED_TOPIC = '0x5986d4da84b4e4719683f1ba6994a5bac9ff76c75db61b1a949e5b7d3424e892';
const BID_CANCELED_TOPIC = '0xbd8de31a25c2b7c2ddafffe72dab91b4ce5826cfd5664793eb206f572f732c27';
const TOKENS_PURCHASED_TOPIC = '0x0d1a0d5e3d583a0e92588799dd06e50fd78c07daf05f0cc06d7b848b1ca445f1';

// --- Utils ---

export async function fetchLogs(address: string, topics: (string | null)[], fromBlock = 21000000) {
    const query = new URLSearchParams({
        module: 'logs',
        action: 'getLogs',
        fromBlock: fromBlock.toString(),
        toBlock: 'latest',
        address: address,
        apikey: ETHERSCAN_API_KEY,
    });

    if (topics[0]) query.append('topic0', topics[0]);
    if (topics[1]) query.append('topic1', topics[1]);
    if (topics[2]) query.append('topic2', topics[2]);

    try {
        const res = await fetch(`${BASE_URL}?${query.toString()}`);
        const data = await res.json();
        if (data.status !== '1' && data.message !== 'No records found') {
            console.error('Etherscan API Error:', data.message);
            return [];
        }
        return data.result || [];
    } catch (err) {
        console.error('Fetch error:', err);
        return [];
    }
}

// Decode address from 32-byte topic
export const decodeAddress = (hex: string) => ethers.getAddress('0x' + hex.slice(-40));

// Decode uint256 from data
export const decodeUint = (hex: string) => BigInt(hex);

// --- Data Aggregators ---

export interface UserStats {
    address: string;
    totalDeposited: number;
    totalUnwrapped: number;
    netShielded: number;
    depositCount: number;
    walletBalance: number; // Placeholder, requires separate ERC20 balance call
    bidCount: number;
    avgBidPrice: number;
    estQty: number;
}

export async function getConfidentailData(): Promise<UserStats[]> {
    // 1. Fetch Deposits (USDT -> Wrapper)
    const deposits = await fetchLogs(USDT_CONTRACT, [TRANSFER_TOPIC, null, ethers.zeroPadValue(WRAPPER_CONTRACT, 32)]);

    // 2. Fetch Withdrawals (Wrapper -> USDT -> User)
    const withdrawals = await fetchLogs(USDT_CONTRACT, [TRANSFER_TOPIC, ethers.zeroPadValue(WRAPPER_CONTRACT, 32), null]);

    // 3. Fetch Bids
    const bids = await fetchLogs(AUCTION_CONTRACT, [BID_SUBMITTED_TOPIC]);

    // 4. Fetch Canceled Bids
    const canceledBids = await fetchLogs(AUCTION_CONTRACT, [BID_CANCELED_TOPIC]);
    const canceledBidIds = new Set(canceledBids.map((log: any) => log.topic1));

    // --- Aggregate ---
    const users: Record<string, UserStats> = {};

    const getUser = (addr: string) => {
        if (!users[addr]) users[addr] = {
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
        return users[addr];
    };

    // Process Deposits
    deposits.forEach((log: any) => {
        const user = getUser(decodeAddress(log.topics[1]));
        const amount = Number(BigInt(log.data)) / 1e6; // USDT 6 decimals
        user.totalDeposited += amount;
        user.netShielded += amount;
        user.depositCount++;
    });

    // Process Withdrawals
    withdrawals.forEach((log: any) => {
        const user = getUser(decodeAddress(log.topics[2]));
        const amount = Number(BigInt(log.data)) / 1e6;
        user.totalUnwrapped += amount;
        user.netShielded -= amount;
    });

    // Process Bids
    const userBids: Record<string, number[]> = {};

    bids.forEach((log: any) => {
        if (canceledBidIds.has(log.topics[1])) return; // Skip canceled

        const bidder = decodeAddress(log.topics[2]);
        const user = getUser(bidder);

        // Data: eQuantity (32), Price (32), ePaid (32)
        // Price is at index 32-64 (2nd param) of data (excluding 0x prefix)
        // Data (hex string) index: 
        // 0-2: "0x"
        // 2-66: eQuantity (32 bytes * 2 hex/byte = 64 chars)
        // 66-130: Price
        const priceHex = '0x' + log.data.slice(66, 130);
        const price = Number(BigInt(priceHex)) / 1e6; // Price has 6 decimals

        user.bidCount++;

        if (!userBids[bidder]) userBids[bidder] = [];
        userBids[bidder].push(price);
    });

    // Calc Avg Price & Est Qty
    Object.values(users).forEach(u => {
        const prices = userBids[u.address] || [];
        if (prices.length > 0) {
            const sum = prices.reduce((a, b) => a + b, 0);
            u.avgBidPrice = sum / prices.length;
            if (u.avgBidPrice > 0) {
                u.estQty = u.netShielded / u.avgBidPrice;
            }
        }
    });

    return Object.values(users).sort((a, b) => b.netShielded - a.netShielded);
}

// --- OG Allocation Data ---

export interface OGUser {
    address: string;
    nftCount: number;
    maxAllocation: number;
    totalSpent: number;
    percentFilled: number;
    zamaClaimed: boolean;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TOKENS_CLAIMED_TOPIC = '0x1f062943399426f37c3da334a1793540e70df4000185981774b7c19183866160';

export async function getOGAllocationData(): Promise<OGUser[]> {
    // 1. Fetch NFT mints (original claimers)
    const nftMints = await fetchLogs(OG_NFT_CONTRACT, [TRANSFER_TOPIC, ethers.zeroPadValue(ZERO_ADDRESS, 32), null]);

    // 2. Fetch TokensPurchased events
    const purchases = await fetchLogs(OG_SALE_CONTRACT, [TOKENS_PURCHASED_TOPIC]);

    // 3. Fetch TokensClaimed events
    const claims = await fetchLogs(OG_SALE_CONTRACT, [TOKENS_CLAIMED_TOPIC]);
    const claimers = new Set(claims.map((log: any) => decodeAddress(log.topics[1])));

    // Count NFTs per original claimer
    const nftCounts: Record<string, number> = {};
    nftMints.forEach((log: any) => {
        const addr = decodeAddress(log.topics[2]);
        nftCounts[addr] = (nftCounts[addr] || 0) + 1;
    });

    // Aggregate purchases
    const userSpend: Record<string, number> = {};
    purchases.forEach((log: any) => {
        const buyer = decodeAddress(log.topics[1]);
        // Data: saleTokenAmount (32), paymentAmount (32)
        const paymentHex = '0x' + log.data.slice(66, 130);
        const payment = Number(BigInt(paymentHex)) / 1e6;
        userSpend[buyer] = (userSpend[buyer] || 0) + payment;
    });

    // Build result
    const result: OGUser[] = Object.entries(userSpend).map(([addr, spent]) => {
        const nftCount = nftCounts[addr] || 0;
        const maxAllocation = nftCount * 200;
        return {
            address: addr,
            nftCount,
            maxAllocation,
            totalSpent: spent,
            percentFilled: maxAllocation > 0 ? (spent / maxAllocation) * 100 : 0,
            zamaClaimed: claimers.has(addr),
        };
    });

    return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

// --- Live Bids Feed ---

export interface LiveBid {
    txHash: string;
    bidder: string;
    price: number;
    timestamp: number;
}

export async function getLiveBids(limit = 50): Promise<LiveBid[]> {
    const bids = await fetchLogs(AUCTION_CONTRACT, [BID_SUBMITTED_TOPIC]);
    const canceledBids = await fetchLogs(AUCTION_CONTRACT, [BID_CANCELED_TOPIC]);
    const canceledBidIds = new Set(canceledBids.map((log: any) => log.topics[1]));

    const activeBids: LiveBid[] = [];

    bids.forEach((log: any) => {
        if (canceledBidIds.has(log.topics[1])) return;

        const priceHex = '0x' + log.data.slice(66, 130);
        activeBids.push({
            txHash: log.transactionHash,
            bidder: decodeAddress(log.topics[2]),
            price: Number(BigInt(priceHex)) / 1e6,
            timestamp: parseInt(log.timeStamp, 16) * 1000,
        });
    });

    return activeBids.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
