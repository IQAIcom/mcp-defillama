/**
 * DefiLlama API Response Types
 * Type definitions for all DefiLlama API endpoints
 */

// ============================================================================
// Protocol & TVL Data
// ============================================================================

/**
 * Chain data response from /v2/chains endpoint
 */
export type ChainData = {
	gecko_id: string | null;
	tvl: number;
	tokenSymbol: string | null;
	cmcId: string | null;
	name: string;
	chainId: number | null;
};

/**
 * Protocol data response from /protocols endpoint
 */
export type ProtocolData = {
	id: string;
	name: string;
	symbol: string;
	category: string;
	chains: string[];
	tvl: number;
	chainTvls?: Record<string, number>;
	change_1h?: number;
	change_1d?: number;
	change_7d?: number;
	currentChainTvls?: Record<string, number>;
	mcap?: number;
	[key: string]: unknown; // Allow additional dynamic properties
};

/**
 * Historical chain TVL data point
 */
export type HistoricalChainTvlItem = {
	date: number;
	tvl: number;
};

// ============================================================================
// DEX Data
// ============================================================================

/**
 * DEX protocol data from /overview/dexs
 */
export type DexProtocolData = {
	name: string;
	displayName: string;
	total24h?: number;
	total7d?: number;
	change_1d?: number;
	change_7d?: number;
	chains?: string[];
	breakdown24h?: Record<string, number>;
	dailyVolume?: number;
	total30d?: number;
	change_1m?: number;
	[key: string]: unknown;
};

/**
 * DEX overview response from /overview/dexs or /overview/dexs/{chain}
 */
export type DexOverviewResponse = {
	protocols?: DexProtocolData[];
	totalDataChart?: Array<[number, number]>;
	totalDataChartBreakdown?: Array<[number, Record<string, unknown>]>;
	allChains?: string[];
	[key: string]: unknown;
};

/**
 * DEX summary response from /summary/dexs/{protocol}
 */
export type DexSummaryResponse = {
	name: string;
	total24h: number;
	totalAllTime?: number;
	totalDataChart?: Array<[number, number]>;
	totalDataChartBreakdown?: Array<[number, Record<string, number>]>;
	chains?: string[];
	[key: string]: unknown;
};

// ============================================================================
// Fees & Revenue
// ============================================================================

/**
 * Fees protocol data from /overview/fees or /overview/fees/{chain}
 */
export type FeesProtocolData = {
	name: string;
	total24h?: number;
	revenue24h?: number;
	change_1d?: number;
	change_7d?: number;
	change_1m?: number;
	chains?: string[];
	dailyUserFees?: number;
	dailyHoldersRevenue?: number;
	dailySupplySideRevenue?: number;
	holdersRevenue30d?: number;
	[key: string]: unknown;
};

/**
 * Fees overview response from /overview/fees or /overview/fees/{chain}
 */
export type FeesOverviewResponse = {
	protocols?: FeesProtocolData[];
	totalDataChart?: Array<[number, number]>;
	totalDataChartBreakdown?: Array<[number, Record<string, number>]>;
	[key: string]: unknown;
};

/**
 * Fees summary response from /summary/fees/{protocol}
 */
export type FeesSummaryResponse = {
	id: string;
	name: string;
	url?: string;
	referralUrl?: string;
	description?: string;
	logo?: string;
	gecko_id?: string;
	cmcId?: string;
	chains?: string[];
	twitter?: string;
	github?: string[];
	symbol?: string;
	address?: string;
	defillamaId?: string;
	disabled?: boolean | null;
	displayName?: string;
	module?: string | null;
	category?: string | null;
	methodologyURL?: string | null;
	methodology?: Record<string, unknown> | null;
	slug?: string;
	protocolType?: string;
	total24h?: number;
	total48hto24h?: number;
	total7d?: number;
	totalAllTime?: number;
	change_1d?: number;
	totalDataChart?: Array<[number, number]>;
	totalDataChartBreakdown?: Array<
		[number, Record<string, Record<string, number>>]
	>;
	[key: string]: unknown;
};

// ============================================================================
// Stablecoins
// ============================================================================

/**
 * Stablecoin data from /stablecoins endpoint
 */
export type StablecoinData = {
	id: string;
	name: string;
	symbol: string;
	pegType: string;
	pegMechanism: string;
	circulating: {
		peggedUSD: number;
	};
	chains?: string[];
	chainCirculating?: Record<
		string,
		{
			current: {
				peggedUSD: number;
			};
		}
	>;
	price?: number;
	circulatingPrevDay?: Record<string, number>;
	circulatingPrevWeek?: Record<string, number>;
	circulatingPrevMonth?: Record<string, number>;
	[key: string]: unknown;
};

/**
 * Stablecoins response from /stablecoins endpoint
 */
export type StablecoinsResponse = {
	peggedAssets: StablecoinData[];
	[key: string]: unknown;
};

/**
 * Stablecoin chain data item from /stablecoinchains endpoint
 */
export type StablecoinChainItem = {
	name: string;
	totalCirculating: {
		peggedUSD: number;
	};
};

/**
 * Stablecoin chart data point from /stablecoincharts endpoint
 */
export type StablecoinChartItem = {
	date: number;
	totalCirculating: {
		peggedUSD: number;
	};
	totalUnreleased?: Record<string, number>;
	totalCirculatingUSD?: number;
	totalMintedUSD?: number;
	totalBridgedToUSD?: number;
	[key: string]: unknown;
};

/**
 * Stablecoin price data point
 */
export type StablecoinPriceItem = {
	date: number;
	prices: Record<string, number>;
};

// ============================================================================
// Prices (Coins)
// ============================================================================

/**
 * Current coin price data from /prices/current/{coins}
 */
export type CurrentCoinPrice = {
	decimals: number;
	price: number;
	symbol: string;
	timestamp: number;
	confidence?: number;
};

/**
 * First recorded coin price data from /prices/first/{coins}
 */
export type FirstCoinPrice = {
	price: number;
	symbol: string;
	timestamp: number;
};

/**
 * Historical price point for batch historical endpoint
 */
export type HistoricalPricePoint = {
	timestamp: number;
	price: number;
	confidence: number;
};

/**
 * Batch historical coin data from /batchHistorical
 */
export type BatchHistoricalCoinData = {
	symbol: string;
	prices: HistoricalPricePoint[];
};

/**
 * Chart price point
 */
export type ChartPricePoint = {
	timestamp: number;
	price: number;
};

/**
 * Chart coin data from /chart/{coins}
 */
export type ChartCoinData = {
	decimals: number;
	confidence: number;
	prices: ChartPricePoint[];
	symbol: string;
};

/**
 * Current prices response from /prices/current/{coins}
 */
export type CurrentPricesResponse = {
	coins: Record<string, CurrentCoinPrice>;
};

/**
 * First prices response from /prices/first/{coins}
 */
export type FirstPricesResponse = {
	coins: Record<string, FirstCoinPrice>;
};

/**
 * Batch historical response from /batchHistorical
 */
export type BatchHistoricalResponse = {
	coins: Record<string, BatchHistoricalCoinData>;
};

/**
 * Percentage change response from /percentage/{coins}
 * Maps coin addresses to their percentage price changes
 * Example: { "ethereum:0x...": -2.30, "bsc:0x...": 5.42 }
 */
export type PercentageResponse = {
	coins: Record<string, number>;
};

/**
 * Chart response from /chart/{coins}
 */
export type ChartResponse = {
	coins: Record<string, ChartCoinData>;
};

// ============================================================================
// Yields
// ============================================================================

/**
 * Pool data for yields from /pools endpoint
 */
export type PoolData = {
	pool: string;
	chain: string;
	project: string;
	symbol: string;
	tvlUsd: number;
	apy: number;
	apyBase?: number;
	apyReward?: number;
	rewardTokens?: string[];
	underlyingTokens?: string[];
	poolMeta?: string;
	url?: string;
	predictions?: {
		predictedClass: string;
		predictedProbability: number;
		binnedConfidence: number;
	};
	[key: string]: unknown;
};

/**
 * Pools response from /pools endpoint
 */
export type PoolsResponse = {
	status: string;
	data: PoolData[];
};

/**
 * Historical pool data point
 */
export type HistoricalPoolItem = {
	timestamp: string;
	tvlUsd: number;
	apy: number;
	apyBase: number;
	apyReward: number;
	[key: string]: unknown;
};

/**
 * Historical pool chart response
 */
export type HistoricalPoolResponse = {
	data: HistoricalPoolItem[];
	[key: string]: unknown;
};

// ============================================================================
// Options
// ============================================================================

/**
 * Options protocol data
 */
export type OptionsProtocolData = {
	name: string;
	displayName?: string;
	disabled?: boolean;
	totalNotionalVolume?: number;
	totalPremiumVolume?: number;
	dailyNotionalVolume?: number;
	dailyPremiumVolume?: number;
	change_1d?: number;
	change_7d?: number;
	change_1m?: number;
	[key: string]: unknown;
};

/**
 * Options overview response
 */
export type OptionsOverviewResponse = {
	protocols?: OptionsProtocolData[];
	totalDataChart?: Array<Record<string, unknown>>;
	[key: string]: unknown;
};

// ============================================================================
// Blockchain
// ============================================================================

/**
 * Block data response
 */
export type BlockData = {
	height: number;
	timestamp: number;
	[key: string]: unknown;
};

// ============================================================================
// Generic API Response Types
// ============================================================================

/**
 * Generic API response wrapper for unknown structures
 * Use this when the response structure is truly dynamic or unknown
 */
export type ApiResponse =
	| Record<string, unknown>
	| Array<Record<string, unknown>>;
