import { type BaseTool, createTool } from "@iqai/adk";
import { z } from "zod";
import {
	needsResolution,
	resolveBridge,
	resolveChain,
	resolveOption,
	resolveProtocol,
	resolveStablecoin,
} from "../lib/resolvers/entity-resolver.js";
import { createChildLogger } from "../lib/utils/index.js";
import {
	blockchainService,
	dexService,
	feesService,
	optionsService,
	priceService,
	protocolService,
	stablecoinService,
	yieldService,
} from "../services/index.js";

const logger = createChildLogger("DefiLlama MCP Tools");

const unixTimestampArg = () =>
	z.union([z.number().int().nonnegative(), z.string().min(1)]);

const optionalSearchWidthArg = () =>
	z.union([z.string().min(1), z.number().positive()]).optional();

/**
 * Helper to set query on all services when _userQuery is provided in args
 * This is called from MCP tool execute functions to enable context-aware filtering
 */
function setQueryFromArgs(args: Record<string, unknown>) {
	const query = args._userQuery as string | undefined;
	if (query) {
		blockchainService.setQuery(query);
		dexService.setQuery(query);
		feesService.setQuery(query);
		optionsService.setQuery(query);
		priceService.setQuery(query);
		protocolService.setQuery(query);
		stablecoinService.setQuery(query);
		yieldService.setQuery(query);
	}
}

/**
 * Helper to extract user query from context.userContent
 * The userContent contains the original user message that started the invocation
 */
function extractQueryFromContext(context?: {
	userContent?: { parts?: Array<{ text?: string }> };
}): string | null {
	if (!context?.userContent?.parts) return null;

	// Extract text from the first part (which contains the user's query)
	const firstPart = context.userContent.parts[0];
	return firstPart?.text || null;
}

/**
 * Automatically resolve human-friendly entity names to API-compatible IDs/slugs
 * Handles protocols, chains, stablecoins, bridges, and options
 */
async function autoResolveEntities(
	args: Record<string, unknown>,
): Promise<void> {
	// Protocol resolution
	if (args.protocol && typeof args.protocol === "string") {
		logger.info(`Resolving protocol: ${args.protocol}`);
		const resolved = await resolveProtocol(args.protocol);
		if (resolved) {
			logger.info(`Resolved "${args.protocol}" → "${resolved}"`);
			args.protocol = resolved;
		} else {
			logger.warn(`Could not resolve protocol: ${args.protocol}`);
		}
	}

	// Chain resolution
	if (args.chain && typeof args.chain === "string") {
		logger.info(`Resolving chain: ${args.chain}`);
		const resolved = await resolveChain(args.chain);
		if (resolved) {
			logger.info(`Resolved "${args.chain}" → "${resolved}"`);
			args.chain = resolved;
		} else {
			logger.warn(`Could not resolve chain: ${args.chain}`);
		}
	}

	// Stablecoin resolution (for stablecoin parameter)
	if (
		args.stablecoin &&
		typeof args.stablecoin === "string" &&
		needsResolution(args.stablecoin, "stablecoin")
	) {
		logger.info(`Resolving stablecoin: ${args.stablecoin}`);
		const resolved = await resolveStablecoin(args.stablecoin);
		if (resolved) {
			logger.info(`Resolved "${args.stablecoin}" → ID ${resolved}`);
			args.stablecoin = resolved;
		} else {
			logger.warn(`Could not resolve stablecoin: ${args.stablecoin}`);
		}
	}

	// Bridge resolution
	if (
		args.bridge &&
		typeof args.bridge === "string" &&
		needsResolution(args.bridge, "bridge")
	) {
		logger.info(`Resolving bridge: ${args.bridge}`);
		const resolved = await resolveBridge(args.bridge);
		if (resolved) {
			logger.info(`Resolved "${args.bridge}" → ID ${resolved}`);
			args.bridge = resolved;
		} else {
			logger.warn(`Could not resolve bridge: ${args.bridge}`);
		}
	}

	// Option resolution
	if (
		args.option &&
		typeof args.option === "string" &&
		needsResolution(args.option, "option")
	) {
		logger.info(`Resolving option: ${args.option}`);
		const resolved = await resolveOption(args.option);
		if (resolved) {
			logger.info(`Resolved "${args.option}" → "${resolved}"`);
			args.option = resolved;
		} else {
			logger.warn(`Could not resolve option: ${args.option}`);
		}
	}
}

/**
 * Tool definitions for FastMCP (MCP Server usage)
 * These are exported as plain objects with Zod schemas for FastMCP compatibility
 */
export const defillamaTools = [
	// Protocol & TVL Data
	{
		name: "defillama_get_chains",
		description:
			"Fetches blockchain chains ranked by Total Value Locked (TVL), returning the top 20. Use this tool to: (1) answer user queries about leading DeFi blockchains, or (2) discover valid chain name formats before calling other tools. The returned chain names (e.g., 'Ethereum', 'Arbitrum', 'Polygon') can be used directly in the 'chain' parameter of defillama_get_dexs_data, defillama_get_fees_and_revenue, and defillama_get_historical_chain_tvl",
		parameters: z.object({
			order: z
				.enum(["asc", "desc"])
				.default("desc")
				.describe(
					"Sort order by TVL. Use 'desc' (default) for highest TVL first (e.g., Ethereum, BSC, Tron), or 'asc' for lowest TVL first",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: { order: "asc" | "desc"; _userQuery?: string }) => {
			setQueryFromArgs(args);
			return await protocolService.getChains(args);
		},
	},

	{
		name: "defillama_get_protocol_data",
		description:
			"Fetches TVL (Total Value Locked) data for DeFi protocols. **AUTO-RESOLUTION ENABLED:** Pass protocol names as users mention them (e.g., 'Lido', 'Uniswap', 'Aave', 'MakerDAO') - they're automatically resolved to correct slugs via AI. For multiple versions, specify the version (e.g., 'Aave V3') or the most common version is matched. If protocol parameter is omitted, returns top 10 protocols sorted by your chosen criteria.",
		parameters: z.object({
			protocol: z
				.string()
				.optional()
				.describe(
					"Protocol name as mentioned by the user - auto-resolved via AI (e.g., 'Lido', 'Uniswap', 'Aave V3', 'Curve', 'MakerDAO'). Exact slugs also work. Flexible matching handles name variations. If omitted, returns top 10 protocols sorted by the specified condition.",
				),
			sortCondition: z
				.enum(["change_1h", "change_1d", "change_7d", "tvl"])
				.default("tvl")
				.describe(
					"Field to sort results by. Only used when protocol parameter is omitted.",
				),
			order: z
				.enum(["asc", "desc"])
				.default("desc")
				.describe("Sort order. Only used when protocol parameter is omitted."),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			protocol?: string;
			sortCondition: "change_1h" | "change_1d" | "change_7d" | "tvl";
			order: "asc" | "desc";
			_userQuery?: string;
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await protocolService.getProtocolData(args);
		},
	},

	{
		name: "defillama_get_historical_chain_tvl",
		description:
			"Fetches historical TVL (Total Value Locked) data for blockchain chains over time. Returns the last 10 data points showing TVL evolution. Can return data for a specific chain or aggregated data across all chains. **AUTO-RESOLUTION ENABLED:** Chain names are automatically matched (e.g., 'Ethereum', 'BSC', 'Polygon', 'Avalanche').",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Blockchain name - auto-resolved (e.g., 'Ethereum', 'Arbitrum', 'Polygon', 'BSC', 'Avalanche'). Common variations are handled automatically. If omitted, returns aggregated historical TVL across all chains combined",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: { chain?: string; _userQuery?: string }) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await protocolService.getHistoricalChainTvl(args);
		},
	},

	// DEX Data
	{
		name: "defillama_get_dexs_data",
		description:
			"Fetches DEX (decentralized exchange) trading volume data and metrics. Returns different levels of data based on parameters: specific protocol data (most detailed), chain-specific overview, or global overview (all DEXs). **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.",
		parameters: z.object({
			excludeTotalDataChart: z
				.boolean()
				.default(true)
				.describe("Whether to exclude total data chart from response"),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.default(true)
				.describe("Whether to exclude chart breakdown from response"),
			protocol: z
				.string()
				.optional()
				.describe(
					"DEX protocol name - auto-resolved (e.g., 'Uniswap', 'PancakeSwap', 'Curve'). When provided, returns detailed data for that protocol only. Takes priority over chain parameter",
				),
			chain: z
				.string()
				.optional()
				.describe(
					"Blockchain name - auto-resolved (e.g., 'Ethereum', 'BSC', 'Polygon', 'Arbitrum'). Returns overview of all DEXs operating on that chain. Only used when protocol is not specified. If both protocol and chain are omitted, returns global overview of all DEXs",
				),
			sortCondition: z
				.enum([
					"total24h",
					"total7d",
					"total30d",
					"change_1d",
					"change_7d",
					"change_1m",
				])
				.default("total24h")
				.describe("Field to sort results by"),
			order: z
				.enum(["asc", "desc"])
				.default("desc")
				.describe("Sort order (ascending or descending)"),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			excludeTotalDataChart: boolean;
			excludeTotalDataChartBreakdown: boolean;
			protocol?: string;
			chain?: string;
			sortCondition:
				| "total24h"
				| "total7d"
				| "total30d"
				| "change_1d"
				| "change_7d"
				| "change_1m";
			order: "asc" | "desc";
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await dexService.getDexsData(args);
		},
	},

	// Fees & Revenue
	{
		name: "defillama_get_fees_and_revenue",
		description:
			"Fetches fees and revenue metrics for DeFi protocols. Can filter by specific protocol and/or chain. **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.",
		parameters: z.object({
			excludeTotalDataChart: z
				.boolean()
				.default(true)
				.describe("Whether to exclude total data chart"),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.default(true)
				.describe("Whether to exclude chart breakdown"),
			dataType: z
				.enum(["dailyFees", "dailyRevenue", "dailyHoldersRevenue"])
				.default("dailyFees")
				.describe("Type of metric to retrieve"),
			chain: z
				.string()
				.optional()
				.describe(
					"Chain name - auto-resolved (e.g., 'Ethereum', 'Polygon', 'BSC'). If omitted, includes all chains",
				),
			protocol: z
				.string()
				.optional()
				.describe(
					"Protocol name - auto-resolved (e.g., 'Uniswap', 'Aave'). If omitted, includes all protocols",
				),
			sortCondition: z
				.enum([
					"change_1d",
					"change_7d",
					"change_1m",
					"total24h",
					"total7d",
					"total30d",
					"dailyUserFees",
					"dailyHoldersRevenue",
					"dailySupplySideRevenue",
					"holdersRevenue30d",
				])
				.default("total24h")
				.describe("Field to sort results by"),
			order: z.enum(["asc", "desc"]).default("desc").describe("Sort order"),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			excludeTotalDataChart: boolean;
			excludeTotalDataChartBreakdown: boolean;
			dataType: "dailyFees" | "dailyRevenue" | "dailyHoldersRevenue";
			chain?: string;
			protocol?: string;
			sortCondition: string;
			order: "asc" | "desc";
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await feesService.getFeesAndRevenue(args);
		},
	},

	// Stablecoins
	{
		name: "defillama_get_stablecoin",
		description:
			"Fetches stablecoin data including circulation and price information. Returns top 20 stablecoins",
		parameters: z.object({
			includePrices: z
				.boolean()
				.optional()
				.describe("Whether to include price data"),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: { includePrices?: boolean; _userQuery?: string }) => {
			setQueryFromArgs(args);
			return await stablecoinService.getStableCoin(args);
		},
	},

	{
		name: "defillama_get_stablecoin_chains",
		description:
			"Fetches stablecoin data by chains. Returns last 3 chains with market cap data",
		parameters: z.object({
			_userQuery: z.string().optional(),
		}),
		execute: async (args: Record<string, unknown>) => {
			setQueryFromArgs(args);
			return await stablecoinService.getStableCoinChains();
		},
	},

	{
		name: "defillama_get_stablecoin_charts",
		description:
			"Fetches historical market cap charts for stablecoins over time. Returns the last 10 data points showing circulation, USD values, and bridged amounts. Can filter by blockchain or specific stablecoin, or show global aggregated data",
		parameters: z.object({
			stablecoin: z
				.union([z.number().int(), z.string()])
				.optional()
				.describe(
					"Stablecoin ID or name (e.g., 1 for USDT, 2 for USDC, or 'USDC', 'Tether', 'DAI'). **AUTO-RESOLUTION ENABLED:** You can now pass stablecoin names directly (like 'USDC', 'Tether', 'DAI') and they will be automatically resolved to their numeric IDs. Numeric IDs are also still accepted. Can be combined with chain parameter to show that stablecoin's data on a specific chain",
				),
			chain: z
				.string()
				.optional()
				.describe(
					"Blockchain name to filter stablecoin data by (e.g., 'Ethereum', 'Polygon', 'Arbitrum'). Returns stablecoin market cap data for that specific chain. **If the user mentions a blockchain but you're unsure of the exact name format, call defillama_get_chains first to discover valid chain names**. If omitted, returns global aggregated data across all chains",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			chain?: string;
			stablecoin?: number | string;
			_userQuery?: string;
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await stablecoinService.getStableCoinCharts(args);
		},
	},

	{
		name: "defillama_get_stablecoin_prices",
		description:
			"Fetches historical stablecoin price data. Returns last 3 data points",
		parameters: z.object({
			_userQuery: z.string().optional(),
		}),
		execute: async (args: Record<string, unknown>) => {
			setQueryFromArgs(args);
			return await stablecoinService.getStableCoinPrices();
		},
	},

	// Prices
	{
		name: "defillama_get_prices_current_coins",
		description:
			"Fetches current token prices from DefiLlama. Requires token addresses in the format chain:address (e.g., 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' for USDT). Can fetch multiple tokens at once by comma-separating them",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated list of tokens in the format {chain}:{contractAddress}. Examples: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' (single token), 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7,bsc:0x55d398326f99059ff775485246999027b3197955' (multiple tokens). If the user mentions a token but you don't know its contract address, you may need to search for it first or ask the user. If unsure about the exact chain name format, call defillama_get_chains to see available chains (e.g., 'ethereum', 'bsc', 'polygon', 'arbitrum')",
				),
			searchWidth: z
				.union([z.string(), z.number()])
				.default("4h")
				.describe(
					"Time window to search for price data. Accepts duration strings (e.g., '4h', '1d', '30m') or seconds as a number (e.g., 600 for 10 minutes). Defaults to 4 hours. Use larger values if recent price data might not be available",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			coins: string;
			searchWidth: string | number;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await priceService.getPricesCurrentCoins(args);
		},
	},

	{
		name: "defillama_get_prices_first_coins",
		description:
			"Fetches the first recorded historical prices for specified cryptocurrency tokens. Useful for finding when a token was first listed/tracked or its initial price point",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated list of tokens in the format '{chain}:{tokenAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' (USDT), 'bsc:0x55d398326f99059ff775485246999027b3197955' (USDT on BSC), or multiple tokens: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7,ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'. Chain names must match exactly - if unsure about the correct chain name format, call defillama_get_chains first to discover valid chain names (e.g., 'ethereum' not 'Ethereum', 'bsc' not 'BSC'). Token addresses are checksummed contract addresses on the specified chain",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: { coins: string; _userQuery?: string }) => {
			setQueryFromArgs(args);
			return await priceService.getPricesFirstCoins(args);
		},
	},

	{
		name: "defillama_get_batch_historical",
		description:
			"Fetches historical price data for multiple cryptocurrencies at specific timestamps. Useful for getting prices of multiple coins at the same or different points in time",
		parameters: z.object({
			coins: z
				.union([
					z.string().min(1),
					z.record(
						z.string(),
						z
							.array(
								z.union([z.number().int().nonnegative(), z.string().min(1)]),
							)
							.min(1),
					),
				])
				.describe(
					"Coin identifiers with timestamps. Use object format: { 'chain:address': [timestamp1, timestamp2, ...] }. Examples: { 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7': [1648680149] } for USDT on Ethereum, or { 'coingecko:bitcoin': [1648680149, 1648766549] } for Bitcoin at multiple times. Chain names should match format from defillama_get_chains (e.g., 'ethereum', 'bsc', 'polygon'). For well-known coins, use 'coingecko:' prefix with coin ID. Timestamps are Unix timestamps in seconds. If you're unsure about the correct chain:address format for a token, you may need to search for the token's contract address first",
				),
			searchWidth: z
				.union([z.string(), z.number()])
				.default("6h")
				.describe(
					"Time range around each timestamp to search for price data. Accepts duration strings (e.g., '4h', '1d', '30m') or seconds as a number (e.g., 600 for 10 minutes). Defaults to '6h' (6 hours). Wider ranges increase chances of finding data but may be less precise",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			coins: string | Record<string, Array<number | string>>;
			searchWidth?: string | number;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await priceService.getBatchHistorical({
				coins:
					typeof args.coins === "string"
						? args.coins
						: encodeURIComponent(JSON.stringify(args.coins)),
				searchWidth: args.searchWidth,
			});
		},
	},

	{
		name: "defillama_get_historical_prices_by_contract",
		description:
			"Fetches historical prices for tokens at a specific point in time using their contract addresses. Useful for getting price data at exact timestamps for analysis or backtesting",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated list of tokens in format '{chain}:{contractAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token) or 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878' (multiple tokens). **IMPORTANT: If user mentions a chain name, call defillama_get_chains first to get the correct chain identifier. For contract addresses, ensure you have the exact address for the token on that specific chain**",
				),
			timestamp: unixTimestampArg().describe(
				"Point in time to query prices for. Accepts Unix timestamp (seconds) or ISO 8601 format (e.g., '2024-01-15T12:00:00Z'). Example: 1705320000 or '2024-01-15T12:00:00Z'",
			),
			searchWidth: optionalSearchWidthArg()
				.default("6h")
				.describe(
					"Time window to search for price data around the timestamp if exact data unavailable. Accepts duration string (e.g., '4h', '1d') or seconds (e.g., 600). Defaults to 6 hours. Larger windows increase chances of finding data but may be less accurate",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			coins: string;
			timestamp: number | string;
			searchWidth: string | number;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await priceService.getHistoricalPricesByContractAddress(args);
		},
	},

	{
		name: "defillama_get_percentage_coins",
		description:
			"Fetches percentage price change for tokens over a specified time period. Calculates how much token prices changed from a starting point, either looking backward (default) or forward in time",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated list of tokens in format '{chain}:{contractAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token) or 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878,ethereum:0xdB25f211AB05b1c97D595516F45794528a807ad8' (multiple tokens). **IMPORTANT: If user mentions a chain name, call defillama_get_chains first to get the correct chain identifier. For contract addresses, ensure you have the exact address for the token on that specific chain**",
				),
			timestamp: unixTimestampArg()
				.optional()
				.describe(
					"Starting point in time for percentage calculation. Accepts Unix timestamp (seconds) or ISO 8601 format. If omitted, uses current time. Examples: 1705320000 or '2024-01-15T12:00:00Z'",
				),
			period: z
				.string()
				.default("1d")
				.describe(
					"Time period over which to calculate percentage change. Format: number + unit (h=hours, d=days). Examples: '1h' (1 hour), '8h' (8 hours), '2d' (2 days), '7d' (7 days). Defaults to '1d' (24 hours)",
				),
			lookForward: z
				.boolean()
				.default(false)
				.describe(
					"Direction to calculate change. If false (default), calculates change from [timestamp - period] to [timestamp] (looking backward). If true, calculates change from [timestamp] to [timestamp + period] (looking forward). Use true for historical predictions/projections",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			coins: string;
			timestamp?: string | number;
			period: string;
			lookForward: boolean;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await priceService.getPercentageCoins(args);
		},
	},

	{
		name: "defillama_get_chart_coins",
		description:
			"Fetches historical price chart data for one or more cryptocurrency tokens across different blockchains. Returns time-series price data with customizable time range and data point frequency",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated list of tokens in the format '{chain}:{contractAddress}'. Each token must be specified with its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token), 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878' (multiple tokens). You can also use CoinGecko IDs like 'coingecko:ethereum'. If you don't know the contract address for a token, search for it first using other available tools or use the CoinGecko ID format",
				),
			start: unixTimestampArg()
				.optional()
				.describe(
					"Unix timestamp (in seconds) for the earliest data point. If omitted, defaults to earliest available data. Example: 1640995200 (Jan 1, 2022)",
				),
			end: unixTimestampArg()
				.optional()
				.describe(
					"Unix timestamp (in seconds) for the latest data point. If omitted, defaults to current time. Example: 1672531200 (Jan 1, 2023)",
				),
			span: z
				.number()
				.int()
				.nonnegative()
				.optional()
				.describe(
					"Number of data points to return in the chart. Higher values provide more granular data. If omitted, returns all available points within the time range. Example: 10 returns 10 evenly-spaced data points",
				),
			period: z
				.string()
				.optional()
				.describe(
					"Time interval between data points. Determines chart granularity. Format: number + unit (h for hours, d for days). Examples: '1h' (hourly data), '8h' (every 8 hours), '1d' (daily data), '7d' (weekly data). If omitted, defaults to 24 hours (daily)",
				),
			searchWidth: optionalSearchWidthArg()
				.default("6h")
				.describe(
					"Time window for finding price data around each period point. Can be specified as seconds (number) or duration string. Wider search windows are more forgiving but may be less precise. Examples: '600' (10 minutes), '6h' (6 hours). Defaults to 6 hours",
				),

			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			coins: string;
			start?: number;
			end?: number;
			span?: number;
			period?: string;
			searchWidth: string | number;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await priceService.getChartCoins(args);
		},
	},

	// Yields
	{
		name: "defillama_get_latest_pool_data",
		description:
			"Fetches current yield farming pool data including APY rates, TVL, and rewards. Returns a list of pools that can be filtered and sorted by various metrics",
		parameters: z.object({
			sortCondition: z
				.enum([
					"tvlUsd",
					"apy",
					"apyBase",
					"apyReward",
					"apyPct1D",
					"apyPct7D",
					"apyPct30D",
					"apyMean30d",
				])
				.default("tvlUsd")
				.describe(
					"Field to sort results by (e.g., tvlUsd for total value locked, apy for annual percentage yield)",
				),
			order: z
				.enum(["asc", "desc"])
				.default("desc")
				.describe("Sort order (ascending or descending)"),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(10)
				.describe("Number of pools to return (between 1-100)"),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			sortCondition:
				| "tvlUsd"
				| "apy"
				| "apyBase"
				| "apyReward"
				| "apyPct1D"
				| "apyPct7D"
				| "apyPct30D"
				| "apyMean30d";
			order: "asc" | "desc";
			limit: number;
			_userQuery?: string;
		}) => {
			setQueryFromArgs(args);
			return await yieldService.getLatestPoolData(args);
		},
	},

	{
		name: "defillama_get_historical_pool_data",
		description:
			"Fetches historical APY and TVL data for a specific yield farming pool over time. Returns the last 10 data points showing how the pool's metrics have changed",
		parameters: z.object({
			pool: z
				.string()
				.describe(
					"Unique pool identifier (UUID format). **IMPORTANT: Always call defillama_get_latest_pool_data first** to discover available pools and their IDs. The pool ID is returned in the 'pool' property of each result (e.g., '742c4e8f-1f3d-4c3e-9c1e-2a3b4c5d6e7f')",
				),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: { pool: string; _userQuery?: string }) => {
			setQueryFromArgs(args);
			return await yieldService.getHistoricalPoolData(args);
		},
	},

	// Options
	{
		name: "defillama_get_options_data",
		description:
			"Fetches options protocol data including trading volume and premium metrics. Returns different levels of data: specific protocol data (most detailed), chain-specific overview, or global overview (all options protocols). **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.",
		parameters: z.object({
			dataType: z
				.enum(["dailyPremiumVolume", "dailyNotionalVolume"])
				.default("dailyNotionalVolume")
				.describe(
					"Type of volume data to retrieve: premium volume (actual premiums paid) or notional volume (value of underlying assets)",
				),
			protocol: z
				.string()
				.optional()
				.describe(
					"Options protocol name - auto-resolved (e.g., 'Lyra', 'Hegic', 'Aevo'). When provided, returns detailed data for that protocol only. Takes priority over chain parameter",
				),
			chain: z
				.string()
				.optional()
				.describe(
					"Blockchain name - auto-resolved (e.g., 'Ethereum', 'Arbitrum', 'Optimism'). Returns overview of all options protocols operating on that chain. Only used when protocol is not specified. If both protocol and chain are omitted, returns global overview of all options protocols",
				),
			sortCondition: z
				.enum([
					"total24h",
					"total7d",
					"total30d",
					"change_1d",
					"change_7d",
					"change_1m",
				])
				.default("total24h")
				.describe("Field to sort results by"),
			order: z
				.enum(["asc", "desc"])
				.default("desc")
				.describe("Sort order (ascending or descending)"),
			excludeTotalDataChart: z
				.boolean()
				.default(true)
				.describe("Whether to exclude aggregated chart data from response"),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.default(true)
				.describe("Whether to exclude broken down chart data from response"),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			dataType: "dailyPremiumVolume" | "dailyNotionalVolume";
			protocol?: string;
			chain?: string;
			sortCondition:
				| "total24h"
				| "total7d"
				| "total30d"
				| "change_1d"
				| "change_7d"
				| "change_1m";
			order: "asc" | "desc";
			excludeTotalDataChart: boolean;
			excludeTotalDataChartBreakdown: boolean;
			_userQuery?: string;
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await optionsService.getOptionsData(args);
		},
	},

	// Blockchain
	{
		name: "defillama_get_blockchain_timestamp",
		description:
			"Fetches blockchain block information for a specific chain at a given timestamp. Returns the block number, timestamp, and height that existed at that point in time. This is essential for historical DeFi queries - many blockchain APIs require a specific block number to retrieve historical state (e.g., 'What was the TVL on date X?' requires knowing which block number corresponded to date X). Use this tool to convert human-readable dates into block numbers. **AUTO-RESOLUTION ENABLED:** Chain names are automatically matched.",
		parameters: z.object({
			chain: z
				.string()
				.describe(
					"Blockchain name - auto-resolved (e.g., 'Ethereum', 'Polygon', 'Arbitrum', 'Avalanche', 'BSC'). Common variations are handled automatically",
				),
			timestamp: unixTimestampArg().describe(
				"Time to query block data for. Accepts both Unix timestamp in seconds (e.g., 1640000000) or ISO 8601 date string (e.g., '2024-01-15T10:30:00Z', '2024-01-15'). Relative dates work too - the converter will handle them. Will be automatically converted to Unix timestamp for the API call",
			),
			_userQuery: z.string().optional(),
		}),
		execute: async (args: {
			chain: string;
			timestamp: number | string;
			_userQuery?: string;
		}) => {
			await autoResolveEntities(args);
			setQueryFromArgs(args);
			return await blockchainService.getBlockChainTimestamp(args);
		},
	},
] as const;

/**
 * Get all DefiLlama tools as ADK BaseTool instances
 * Use this function when integrating with ADK agents
 */
export const getDefillamaTools = (): BaseTool[] => {
	return defillamaTools.map((tool) =>
		createTool({
			name: tool.name,
			description: tool.description,
			schema: tool.parameters as z.ZodSchema<Record<string, unknown>>,
			fn: async (args, context) => {
				// Extract and inject user query from context.userContent into all services
				const query = extractQueryFromContext(context);
				logger.info(
					`Extracted user query from context: ${query ? `${query.substring(0, 100)}...` : "none"}`,
				);
				if (query) {
					logger.info(
						`Setting user query for filtering: ${query.substring(0, 100)}...`,
					);
					blockchainService.setQuery(query);
					dexService.setQuery(query);
					feesService.setQuery(query);
					optionsService.setQuery(query);
					priceService.setQuery(query);
					protocolService.setQuery(query);
					stablecoinService.setQuery(query);
					yieldService.setQuery(query);
				}
				return await tool.execute(args as never);
			},
		}),
	);
};
