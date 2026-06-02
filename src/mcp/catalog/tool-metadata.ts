// src/mcp/catalog/tool-metadata.ts
//
// Side-effect-free metadata describing every upstream DefiLlama endpoint
// (one entry per endpoint). Used by:
//   - scripts/build-docs-index.ts (build-time docs index generation)
//   - the execute sandbox client + dynamic endpoint tools (dispatch)
//
// DO NOT IMPORT (as a value) from src/services/ — services/index.ts
// constructs the eight singletons at load time. Importing it here would
// defeat the "side-effect-free" guarantee enforced by
// tool-metadata.import.test.ts. The only services reference is a TYPE
// import (erased at compile time); the real module is pulled in via the
// dynamic import inside lazyMethod's returned thunk, at dispatch time.

import { z } from "zod";
/*
 * Type-only import — erased at compile time, preserves the
 * "tool-metadata.ts must be side-effect-free at module load" invariant.
 */
import type * as Services from "../../services/index.js";
import {
	BatchHistoricalSchema,
	BlockSchema,
	ChainsSchema,
	CurrentPricesSchema,
	DexOverviewSchema,
	DexSummarySchema,
	FeesOverviewSchema,
	FeesSummarySchema,
	FirstPricesSchema,
	HistoricalChainTvlSchema,
	HistoricalPoolSchema,
	OptionsOverviewSchema,
	OptionsSummarySchema,
	PercentageSchema,
	PoolsSchema,
	PriceChartSchema,
	ProtocolSchema,
	ProtocolsSchema,
	StablecoinChainsSchema,
	StablecoinChartsSchema,
	StablecoinPricesSchema,
	StablecoinsSchema,
} from "./response-schemas.js";

type ServicesShape = typeof Services;

type ServiceKey =
	| "protocolService"
	| "dexService"
	| "feesService"
	| "optionsService"
	| "stablecoinService"
	| "priceService"
	| "yieldService"
	| "blockchainService";

/**
 * Lazily resolves an instance method on one of the eight service singletons
 * and returns it bound to that singleton. The generic constraints make
 * typos in either argument a compile error:
 *   - `serviceKey` must be one of the eight named services
 *   - `methodKey` must be `keyof typeof <that service>`
 *
 * Returns an async thunk — services/index.ts loads only when the thunk
 * is invoked at dispatch time, not when tool-metadata.ts loads.
 */
function lazyMethod<K extends ServiceKey, M extends keyof ServicesShape[K]>(
	serviceKey: K,
	methodKey: M,
): () => Promise<(...args: unknown[]) => unknown> {
	return async () => {
		const services = await import("../../services/index.js");
		const svc = services[serviceKey] as unknown as Record<string, unknown>;
		const fn = svc[methodKey as string];
		if (typeof fn !== "function") {
			throw new Error(
				`${serviceKey}.${String(methodKey)} is not a function (this should be unreachable — TypeScript should have caught it)`,
			);
		}
		return (fn as (...a: unknown[]) => unknown).bind(svc);
	};
}

export type ToolMetadata = {
	/** Catalog tool name, e.g. "defillama_get_chains". */
	name: string;
	/** Agent-facing sandbox call path, e.g. "defillama.protocol.getChains". */
	qualified: string;
	/** Lazy reference to the JSON-returning *Raw method. Bound to its singleton. */
	sandboxImpl: () => Promise<(...args: unknown[]) => unknown>;
	/** Agent-facing description of the endpoint. */
	description: string;
	/** Zod schema for input parameters (upstream args only). */
	parameters: z.ZodTypeAny;
	/** Zod schema for the full upstream JSON response. Context for jq construction. */
	responseSchema: z.ZodTypeAny;
	/** Example agent code snippet (one line). */
	exampleCall: string;
};

const searchWidthArg = () => z.union([z.string(), z.number()]);
const unixTimestampArg = () =>
	z.union([z.number().int().nonnegative(), z.string().min(1)]);

export const TOOL_METADATA: ToolMetadata[] = [
	// ── Protocol & TVL (api.llama.fi) ──────────────────────────────────────
	{
		name: "defillama_get_chains",
		qualified: "defillama.protocol.getChains",
		sandboxImpl: lazyMethod("protocolService", "getChainsRaw"),
		description:
			"List every chain DefiLlama tracks, each with its current TVL. Returns the full array (sort/slice in your execute() script). The chain display names here (e.g. 'Ethereum', 'Arbitrum') feed api.llama.fi endpoints; lowercase the slug (e.g. 'ethereum') for coins.llama.fi price/block calls.",
		parameters: z.object({}),
		responseSchema: ChainsSchema,
		exampleCall: "await defillama.protocol.getChains()",
	},
	{
		name: "defillama_get_protocols",
		qualified: "defillama.protocol.getProtocols",
		sandboxImpl: lazyMethod("protocolService", "getProtocolsRaw"),
		description:
			"List every DeFi protocol DefiLlama tracks with its TVL, category, chains and recent change metrics. Returns the full unsorted array (sort/slice/field-pick in your execute() script).",
		parameters: z.object({}),
		responseSchema: ProtocolsSchema,
		exampleCall: "await defillama.protocol.getProtocols()",
	},
	{
		name: "defillama_get_protocol",
		qualified: "defillama.protocol.getProtocol",
		sandboxImpl: lazyMethod("protocolService", "getProtocolRaw"),
		description:
			"Fetch detailed TVL data for a single DeFi protocol, including per-chain TVL breakdowns and historical series. Pass the protocol slug (e.g. 'lido', 'aave-v3'); resolve human-friendly names to slugs with the resolver/catalog before calling.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Protocol slug as used by DefiLlama (e.g. 'lido', 'uniswap', 'aave-v3', 'makerdao'). Resolve display names to slugs deterministically via the catalog before calling.",
				),
		}),
		responseSchema: ProtocolSchema,
		exampleCall: "await defillama.protocol.getProtocol({protocol: 'lido'})",
	},
	{
		name: "defillama_get_historical_chain_tvl",
		qualified: "defillama.protocol.getHistoricalChainTvl",
		sandboxImpl: lazyMethod("protocolService", "getHistoricalChainTvlRaw"),
		description:
			"Fetch the historical TVL time series for a chain, or aggregated across all chains when `chain` is omitted. Returns the full series (slice the tail in your execute() script). Use the chain display name from getChains() (e.g. 'Ethereum'), which feeds the api.llama.fi endpoint.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name (e.g. 'Ethereum', 'Arbitrum', 'Polygon'). If omitted, returns aggregated historical TVL across all chains combined.",
				),
		}),
		responseSchema: HistoricalChainTvlSchema,
		exampleCall:
			"await defillama.protocol.getHistoricalChainTvl({chain: 'Ethereum'})",
	},
	// ── DEX (api.llama.fi) ─────────────────────────────────────────────────
	{
		name: "defillama_get_dex_summary",
		qualified: "defillama.dex.getDexSummary",
		sandboxImpl: lazyMethod("dexService", "getDexSummaryRaw"),
		description:
			"Fetch detailed DEX trading-volume data for a single protocol, including totals and (optionally) the volume chart series. Pass the protocol slug; resolve display names to slugs via the catalog first.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"DEX protocol slug (e.g. 'uniswap', 'pancakeswap', 'curve-dex'). Resolve display names to slugs deterministically via the catalog before calling.",
				),
			excludeTotalDataChart: z
				.boolean()
				.optional()
				.describe(
					"Exclude the aggregated volume chart series from the response (defaults to true upstream).",
				),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.optional()
				.describe(
					"Exclude the per-chain chart breakdown from the response (defaults to true upstream).",
				),
		}),
		responseSchema: DexSummarySchema,
		exampleCall: "await defillama.dex.getDexSummary({protocol: 'uniswap'})",
	},
	{
		name: "defillama_get_dexs_overview",
		qualified: "defillama.dex.getDexsOverview",
		sandboxImpl: lazyMethod("dexService", "getDexsOverviewRaw"),
		description:
			"Fetch a DEX volume overview across all DEXs, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice/field-pick in your execute() script). Use the chain display name (e.g. 'Ethereum').",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name (e.g. 'Ethereum', 'BSC', 'Arbitrum'). If omitted, returns the global overview of all DEXs.",
				),
			excludeTotalDataChart: z
				.boolean()
				.optional()
				.describe(
					"Exclude the aggregated volume chart series from the response (defaults to true upstream).",
				),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.optional()
				.describe(
					"Exclude the per-protocol chart breakdown from the response (defaults to true upstream).",
				),
		}),
		responseSchema: DexOverviewSchema,
		exampleCall: "await defillama.dex.getDexsOverview({chain: 'Ethereum'})",
	},
	// ── Fees & Revenue (api.llama.fi) ──────────────────────────────────────
	{
		name: "defillama_get_fees_summary",
		qualified: "defillama.fees.getFeesSummary",
		sandboxImpl: lazyMethod("feesService", "getFeesSummaryRaw"),
		description:
			"Fetch detailed fees/revenue metrics for a single protocol. Pass the protocol slug; resolve display names to slugs via the catalog first. Use `dataType` to choose which metric series to return.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Protocol slug (e.g. 'uniswap', 'aave'). Resolve display names to slugs deterministically via the catalog before calling.",
				),
			dataType: z
				.enum(["dailyFees", "dailyRevenue", "dailyHoldersRevenue"])
				.optional()
				.describe(
					"Which metric to retrieve: 'dailyFees', 'dailyRevenue', or 'dailyHoldersRevenue'.",
				),
			excludeTotalDataChart: z
				.boolean()
				.optional()
				.describe(
					"Exclude the aggregated chart series from the response (defaults to true upstream).",
				),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.optional()
				.describe(
					"Exclude the per-chain chart breakdown from the response (defaults to true upstream).",
				),
		}),
		responseSchema: FeesSummarySchema,
		exampleCall:
			"await defillama.fees.getFeesSummary({protocol: 'uniswap', dataType: 'dailyRevenue'})",
	},
	{
		name: "defillama_get_fees_overview",
		qualified: "defillama.fees.getFeesOverview",
		sandboxImpl: lazyMethod("feesService", "getFeesOverviewRaw"),
		description:
			"Fetch a fees/revenue overview across all protocols, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice/field-pick in your execute() script). Use the chain display name (e.g. 'Ethereum').",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name (e.g. 'Ethereum', 'Polygon', 'BSC'). If omitted, includes all chains.",
				),
			dataType: z
				.enum(["dailyFees", "dailyRevenue", "dailyHoldersRevenue"])
				.optional()
				.describe(
					"Which metric to retrieve: 'dailyFees', 'dailyRevenue', or 'dailyHoldersRevenue'.",
				),
			excludeTotalDataChart: z
				.boolean()
				.optional()
				.describe(
					"Exclude the aggregated chart series from the response (defaults to true upstream).",
				),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.optional()
				.describe(
					"Exclude the per-protocol chart breakdown from the response (defaults to true upstream).",
				),
		}),
		responseSchema: FeesOverviewSchema,
		exampleCall:
			"await defillama.fees.getFeesOverview({chain: 'Ethereum', dataType: 'dailyFees'})",
	},
	// ── Options (api.llama.fi) ─────────────────────────────────────────────
	{
		name: "defillama_get_options_summary",
		qualified: "defillama.options.getOptionsSummary",
		sandboxImpl: lazyMethod("optionsService", "getOptionsSummaryRaw"),
		description:
			"Fetch detailed options-protocol volume data for a single protocol. Pass the protocol slug; resolve display names to slugs via the catalog first. Use `dataType` to choose premium vs notional volume.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Options protocol slug (e.g. 'lyra', 'hegic', 'aevo'). Resolve display names to slugs deterministically via the catalog before calling.",
				),
			dataType: z
				.enum(["dailyPremiumVolume", "dailyNotionalVolume"])
				.optional()
				.describe(
					"Which volume to retrieve: 'dailyPremiumVolume' (premiums paid) or 'dailyNotionalVolume' (value of underlying assets).",
				),
		}),
		responseSchema: OptionsSummarySchema,
		exampleCall:
			"await defillama.options.getOptionsSummary({protocol: 'lyra'})",
	},
	{
		name: "defillama_get_options_overview",
		qualified: "defillama.options.getOptionsOverview",
		sandboxImpl: lazyMethod("optionsService", "getOptionsOverviewRaw"),
		description:
			"Fetch an options-volume overview across all options protocols, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice in your execute() script). Use the chain display name (e.g. 'Ethereum').",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name (e.g. 'Ethereum', 'Arbitrum', 'Optimism'). If omitted, returns the global overview of all options protocols.",
				),
			dataType: z
				.enum(["dailyPremiumVolume", "dailyNotionalVolume"])
				.optional()
				.describe(
					"Which volume to retrieve: 'dailyPremiumVolume' (premiums paid) or 'dailyNotionalVolume' (value of underlying assets).",
				),
			excludeTotalDataChart: z
				.boolean()
				.optional()
				.describe(
					"Exclude the aggregated chart series from the response (defaults to true upstream).",
				),
			excludeTotalDataChartBreakdown: z
				.boolean()
				.optional()
				.describe(
					"Exclude the per-protocol chart breakdown from the response (defaults to true upstream).",
				),
		}),
		responseSchema: OptionsOverviewSchema,
		exampleCall:
			"await defillama.options.getOptionsOverview({chain: 'Ethereum'})",
	},
	// ── Stablecoins (stablecoins.llama.fi) ─────────────────────────────────
	{
		name: "defillama_get_stablecoin",
		qualified: "defillama.stablecoin.getStablecoins",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinsRaw"),
		description:
			"List all stablecoins with circulation data (and optionally current prices). Returns the full `peggedAssets` array (sort/slice/field-pick in your execute() script).",
		parameters: z.object({
			includePrices: z
				.boolean()
				.optional()
				.describe("Include current price data for each stablecoin."),
		}),
		responseSchema: StablecoinsSchema,
		exampleCall:
			"await defillama.stablecoin.getStablecoins({includePrices: true})",
	},
	{
		name: "defillama_get_stablecoin_chains",
		qualified: "defillama.stablecoin.getStablecoinChains",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinChainsRaw"),
		description:
			"List stablecoin market-cap totals broken down by chain. Returns the full array (slice/sort in your execute() script).",
		parameters: z.object({}),
		responseSchema: StablecoinChainsSchema,
		exampleCall: "await defillama.stablecoin.getStablecoinChains()",
	},
	{
		name: "defillama_get_stablecoin_charts",
		qualified: "defillama.stablecoin.getStablecoinCharts",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinChartsRaw"),
		description:
			"Fetch the historical stablecoin market-cap chart, optionally scoped to a chain and/or a single stablecoin. Returns the full series (slice the tail in your execute() script). Use the chain display name (e.g. 'Ethereum'); omit `chain` for global aggregated data.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name to filter by (e.g. 'Ethereum', 'Polygon'). If omitted, returns global aggregated data across all chains.",
				),
			stablecoin: z
				.union([z.number().int(), z.string()])
				.optional()
				.describe(
					"Stablecoin numeric ID (e.g. 1 for USDT) to filter to a single asset. Resolve symbols/names to IDs deterministically via the catalog before calling.",
				),
		}),
		responseSchema: StablecoinChartsSchema,
		exampleCall:
			"await defillama.stablecoin.getStablecoinCharts({chain: 'Ethereum'})",
	},
	{
		name: "defillama_get_stablecoin_prices",
		qualified: "defillama.stablecoin.getStablecoinPrices",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinPricesRaw"),
		description:
			"Fetch the historical stablecoin price series (per-asset prices over time). Returns the full series (slice the tail in your execute() script).",
		parameters: z.object({}),
		responseSchema: StablecoinPricesSchema,
		exampleCall: "await defillama.stablecoin.getStablecoinPrices()",
	},
	// ── Prices (coins.llama.fi) ────────────────────────────────────────────
	{
		name: "defillama_get_prices_current_coins",
		qualified: "defillama.price.getCurrentPrices",
		sandboxImpl: lazyMethod("priceService", "getCurrentPricesRaw"),
		description:
			"Fetch current token prices. Tokens are identified in the format `{chain}:{address}` with a lowercase chain slug (e.g. 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7'). Comma-separate multiple tokens. CoinGecko IDs use the 'coingecko:<id>' prefix.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `{chain}:{address}` format with a lowercase chain slug (e.g. 'ethereum:0xdac1...,bsc:0x55d3...'), or 'coingecko:<id>' for well-known coins.",
				),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window to search for price data: a duration string (e.g. '4h', '1d', '30m') or seconds as a number (e.g. 600).",
				),
		}),
		responseSchema: CurrentPricesSchema,
		exampleCall:
			"await defillama.price.getCurrentPrices({coins: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7'})",
	},
	{
		name: "defillama_get_prices_first_coins",
		qualified: "defillama.price.getFirstPrices",
		sandboxImpl: lazyMethod("priceService", "getFirstPricesRaw"),
		description:
			"Fetch the first-ever recorded price for each token. Tokens are identified in the format `{chain}:{address}` with a lowercase chain slug (e.g. 'ethereum:0xdac1...'). Comma-separate multiple tokens. Useful for when a token was first listed/tracked.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `{chain}:{address}` format with a lowercase chain slug (e.g. 'ethereum:0xdac1...,bsc:0x55d3...').",
				),
		}),
		responseSchema: FirstPricesSchema,
		exampleCall:
			"await defillama.price.getFirstPrices({coins: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7'})",
	},
	{
		name: "defillama_get_batch_historical",
		qualified: "defillama.price.getBatchHistorical",
		sandboxImpl: lazyMethod("priceService", "getBatchHistoricalRaw"),
		description:
			"Fetch historical prices for many tokens at many timestamps in one call. `coins` is an object mapping `{chain}:{address}` (lowercase chain slug) to an array of Unix timestamps in seconds. A pre-encoded string is also accepted.",
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
					"Object mapping `{chain}:{address}` (lowercase chain slug) to an array of Unix timestamps in seconds, e.g. { 'ethereum:0xdac1...': [1648680149] } or { 'coingecko:bitcoin': [1648680149, 1648766549] }. A pre-encoded string is also accepted.",
				),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window around each timestamp: a duration string (e.g. '6h', '1d') or seconds as a number (e.g. 600).",
				),
		}),
		responseSchema: BatchHistoricalSchema,
		exampleCall:
			"await defillama.price.getBatchHistorical({coins: {'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7': [1648680149]}})",
	},
	{
		name: "defillama_get_historical_prices_by_contract",
		qualified: "defillama.price.getHistoricalPrices",
		sandboxImpl: lazyMethod("priceService", "getHistoricalPricesRaw"),
		description:
			"Fetch token prices at a single point in time. Tokens are identified in the format `{chain}:{address}` with a lowercase chain slug (e.g. 'ethereum:0xdac1...'). Comma-separate multiple tokens. `timestamp` accepts Unix seconds or an ISO 8601 date string.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `{chain}:{address}` format with a lowercase chain slug (e.g. 'ethereum:0xdac1...,bsc:0x55d3...').",
				),
			timestamp: unixTimestampArg().describe(
				"Point in time to query. Unix timestamp in seconds (e.g. 1705320000) or ISO 8601 (e.g. '2024-01-15T12:00:00Z').",
			),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window around the timestamp: a duration string (e.g. '6h', '1d') or seconds as a number.",
				),
		}),
		responseSchema: CurrentPricesSchema,
		exampleCall:
			"await defillama.price.getHistoricalPrices({coins: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7', timestamp: 1705320000})",
	},
	{
		name: "defillama_get_percentage_coins",
		qualified: "defillama.price.getPercentageChange",
		sandboxImpl: lazyMethod("priceService", "getPercentageChangeRaw"),
		description:
			"Fetch the percentage price change for tokens over a period, looking backward (default) or forward. Tokens are `{chain}:{address}` with a lowercase chain slug (e.g. 'ethereum:0xdac1...'). Comma-separate multiple tokens.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `{chain}:{address}` format with a lowercase chain slug (e.g. 'ethereum:0xdac1...,bsc:0x55d3...').",
				),
			period: z
				.string()
				.optional()
				.describe(
					"Period over which to compute the change. Format number+unit (h=hours, d=days), e.g. '1h', '7d'. Defaults to '1d'.",
				),
			lookForward: z
				.boolean()
				.optional()
				.describe(
					"If false (default) compute change from [timestamp - period] to [timestamp]; if true, from [timestamp] to [timestamp + period].",
				),
			timestamp: unixTimestampArg()
				.optional()
				.describe(
					"Starting point for the calculation. Unix seconds or ISO 8601. If omitted, uses the current time.",
				),
		}),
		responseSchema: PercentageSchema,
		exampleCall:
			"await defillama.price.getPercentageChange({coins: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7', period: '7d'})",
	},
	{
		name: "defillama_get_chart_coins",
		qualified: "defillama.price.getPriceChart",
		sandboxImpl: lazyMethod("priceService", "getPriceChartRaw"),
		description:
			"Fetch a historical price chart (time series) for one or more tokens. Tokens are `{chain}:{address}` with a lowercase chain slug (e.g. 'ethereum:0xdac1...'); CoinGecko IDs use 'coingecko:<id>'. Control the range and granularity with start/end/span/period.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `{chain}:{address}` format with a lowercase chain slug (e.g. 'ethereum:0xdac1...,bsc:0x55d3...'), or 'coingecko:<id>'.",
				),
			start: unixTimestampArg()
				.optional()
				.describe(
					"Unix timestamp (seconds) of the earliest data point. If omitted, uses the earliest available data.",
				),
			end: unixTimestampArg()
				.optional()
				.describe(
					"Unix timestamp (seconds) of the latest data point. If omitted, uses the current time.",
				),
			span: z
				.number()
				.int()
				.nonnegative()
				.optional()
				.describe(
					"Number of evenly-spaced data points to return. If omitted, returns all available points in range.",
				),
			period: z
				.string()
				.optional()
				.describe(
					"Interval between data points. Format number+unit (h=hours, d=days), e.g. '1h', '1d'. Defaults to daily.",
				),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window for finding price data around each period point: seconds (number) or a duration string.",
				),
		}),
		responseSchema: PriceChartSchema,
		exampleCall:
			"await defillama.price.getPriceChart({coins: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7', span: 10, period: '1d'})",
	},
	// ── Yields (yields.llama.fi) ───────────────────────────────────────────
	{
		name: "defillama_get_latest_pool_data",
		qualified: "defillama.yield.getLatestPools",
		sandboxImpl: lazyMethod("yieldService", "getLatestPoolsRaw"),
		description:
			"List current yield-farming pools with APY, TVL and reward metrics. Returns the full `data` array (sort/slice/field-pick in your execute() script). Each pool's `pool` UUID feeds getHistoricalPoolData.",
		parameters: z.object({}),
		responseSchema: PoolsSchema,
		exampleCall: "await defillama.yield.getLatestPools()",
	},
	{
		name: "defillama_get_historical_pool_data",
		qualified: "defillama.yield.getHistoricalPoolData",
		sandboxImpl: lazyMethod("yieldService", "getHistoricalPoolDataRaw"),
		description:
			"Fetch the historical APY/TVL series for a single yield pool. Returns the full series (slice the tail in your execute() script). Get the pool UUID from getLatestPools first.",
		parameters: z.object({
			pool: z
				.string()
				.describe(
					"Pool UUID as returned in the `pool` field of getLatestPools (e.g. '747c1d2a-c668-4682-b9f9-296708a3dd90').",
				),
		}),
		responseSchema: HistoricalPoolSchema,
		exampleCall:
			"await defillama.yield.getHistoricalPoolData({pool: '747c1d2a-c668-4682-b9f9-296708a3dd90'})",
	},
	// ── Blockchain (coins.llama.fi) ────────────────────────────────────────
	{
		name: "defillama_get_blockchain_timestamp",
		qualified: "defillama.blockchain.getBlockAtTimestamp",
		sandboxImpl: lazyMethod("blockchainService", "getBlockAtTimestampRaw"),
		description:
			"Resolve the block (height + timestamp) closest to a given time on a chain. Essential for historical queries that need a block number. Use the lowercase chain slug (e.g. 'ethereum') for this coins.llama.fi endpoint. `timestamp` accepts Unix seconds or an ISO 8601 date string.",
		parameters: z.object({
			chain: z
				.string()
				.describe(
					"Lowercase chain slug for the coins.llama.fi endpoint (e.g. 'ethereum', 'polygon', 'arbitrum').",
				),
			timestamp: unixTimestampArg().describe(
				"Time to query. Unix timestamp in seconds (e.g. 1640000000) or ISO 8601 date string (e.g. '2024-01-15T10:30:00Z').",
			),
		}),
		responseSchema: BlockSchema,
		exampleCall:
			"await defillama.blockchain.getBlockAtTimestamp({chain: 'ethereum', timestamp: 1640000000})",
	},
];
