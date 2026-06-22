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
	/**
	 * Example agent code snippet. When the endpoint takes an identifier the
	 * model can't safely guess (a protocol slug, chain name, stablecoin id,
	 * pool UUID, or `{chain}:{address}` coin), the snippet shows the
	 * discovery step first — `defillama.resolve*(input)` or enumeration —
	 * and then the call against the discovered variable. Never bakes a
	 * literal identifier value into the call.
	 */
	exampleCall: string;
	/**
	 * Per-method override of the default 5 s execute-wrapper timeout. The
	 * underlying axios timeout scales with this value (axiosMs = timeoutMs +
	 * AXIOS_BUFFER_MS in execute/client.ts), so use this for endpoints whose
	 * upstream legitimately takes longer than the default budget.
	 */
	timeoutMs?: number;
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
			"List every chain DefiLlama tracks, each with its current TVL. Returns the full array (sort/slice in your execute() script). This is the canonical chain catalog — read the `name` field for api.llama.fi endpoints (case-sensitive display name) and lowercase that same value for coins.llama.fi price/block calls. Prefer `defillama.resolveChain(input)` for translating a human input to the right form; fall back to enumerating this list when the resolver returns null.",
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
			"Fetch detailed TVL data for a single DeFi protocol, including per-chain TVL breakdowns and historical series. Pass the canonical protocol slug from the DefiLlama catalog. Slugs are kebab-case lowercase with version suffixes preserved and are NOT derivable from display names — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.protocol.getProtocols()` and filtering on `name` (see the find-protocol-slug recipe). Don't construct the slug by transforming a display name.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Canonical protocol slug from the DefiLlama catalog (kebab-case). Get the exact value via `defillama.resolveProtocol(name)` or by enumerating `defillama.protocol.getProtocols()` and filtering on `name` — never construct it by transforming a display name.",
				),
		}),
		responseSchema: ProtocolSchema,
		exampleCall:
			"const slug = await defillama.resolveProtocol(name); await defillama.protocol.getProtocol({protocol: slug})",
	},
	{
		name: "defillama_get_historical_chain_tvl",
		qualified: "defillama.protocol.getHistoricalChainTvl",
		sandboxImpl: lazyMethod("protocolService", "getHistoricalChainTvlRaw"),
		description:
			"Fetch the historical TVL time series for a chain, or aggregated across all chains when `chain` is omitted. Returns the full series (slice the tail in your execute() script). The api.llama.fi endpoint expects the chain DISPLAY NAME (the `.name` form, not the lowercase coins-API slug) — get it via `defillama.resolveChain(input).name` or by reading the `name` field off `defillama.protocol.getChains()`. Case matters: some chains use all-caps display names.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name as returned by `defillama.resolveChain(input).name` or the `name` field of `defillama.protocol.getChains()`. Case-sensitive. If omitted, returns aggregated historical TVL across all chains combined.",
				),
		}),
		responseSchema: HistoricalChainTvlSchema,
		exampleCall:
			"const {name} = await defillama.resolveChain(input); await defillama.protocol.getHistoricalChainTvl({chain: name})",
	},
	// ── DEX (api.llama.fi) ─────────────────────────────────────────────────
	{
		name: "defillama_get_dex_summary",
		qualified: "defillama.dex.getDexSummary",
		sandboxImpl: lazyMethod("dexService", "getDexSummaryRaw"),
		description:
			"Fetch detailed DEX trading-volume data for a single DEX protocol, including totals and (optionally) the volume chart series. Pass the canonical DEX protocol slug from the DefiLlama catalog. Slugs are kebab-case and version-suffixed and NOT derivable from display names — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.dex.getDexsOverview().protocols` and filtering on `name`. Don't construct the slug by transforming a display name.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Canonical DEX protocol slug from the DefiLlama catalog (kebab-case). Get the exact value via `defillama.resolveProtocol(name)` or by reading the `slug` field off `defillama.dex.getDexsOverview().protocols` — never construct it by transforming a display name.",
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
		exampleCall:
			"const slug = await defillama.resolveProtocol(name); await defillama.dex.getDexSummary({protocol: slug})",
	},
	{
		name: "defillama_get_dexs_overview",
		qualified: "defillama.dex.getDexsOverview",
		sandboxImpl: lazyMethod("dexService", "getDexsOverviewRaw"),
		description:
			"Fetch a DEX volume overview across all DEXs, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice/field-pick in your execute() script). Use the chain DISPLAY NAME from `defillama.resolveChain(input).name` (case-sensitive).",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name as returned by `defillama.resolveChain(input).name` or the `name` field of `defillama.protocol.getChains()`. Case-sensitive. If omitted, returns the global overview of all DEXs.",
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
		exampleCall:
			"const {name} = await defillama.resolveChain(input); await defillama.dex.getDexsOverview({chain: name})",
	},
	// ── Fees & Revenue (api.llama.fi) ──────────────────────────────────────
	{
		name: "defillama_get_fees_summary",
		qualified: "defillama.fees.getFeesSummary",
		sandboxImpl: lazyMethod("feesService", "getFeesSummaryRaw"),
		description:
			"Fetch detailed fees/revenue metrics for a single protocol. Pass the canonical fees-protocol slug from the DefiLlama catalog. The fees catalog often uses version-suffixed slugs (e.g. a single display name like 'Uniswap' maps to multiple fees-tracked deployments like `uniswap-v2`, `uniswap-v3`, `uniswap-labs`), so discovery is required — use `defillama.resolveProtocol(name)` or enumerate `defillama.fees.getFeesOverview().protocols` and filter on `name`. Don't pass an unversioned display-name guess. Use `dataType` to choose which metric series to return.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Canonical fees-protocol slug from the DefiLlama catalog (kebab-case, often version-suffixed). Get the exact value via `defillama.resolveProtocol(name)` or by reading the `slug` field off `defillama.fees.getFeesOverview().protocols` — never construct it by transforming a display name.",
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
			"const slug = await defillama.resolveProtocol(name); await defillama.fees.getFeesSummary({protocol: slug, dataType: 'dailyRevenue'})",
	},
	{
		name: "defillama_get_fees_overview",
		qualified: "defillama.fees.getFeesOverview",
		sandboxImpl: lazyMethod("feesService", "getFeesOverviewRaw"),
		description:
			"Fetch a fees/revenue overview across all protocols, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice/field-pick in your execute() script). Use the chain DISPLAY NAME from `defillama.resolveChain(input).name` (case-sensitive). This is also the canonical source for discovering valid fees-protocol slugs — read the `slug` field off each entry.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name as returned by `defillama.resolveChain(input).name` or the `name` field of `defillama.protocol.getChains()`. Case-sensitive. If omitted, includes all chains.",
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
			"const {name} = await defillama.resolveChain(input); await defillama.fees.getFeesOverview({chain: name, dataType: 'dailyFees'})",
	},
	// ── Options (api.llama.fi) ─────────────────────────────────────────────
	{
		name: "defillama_get_options_summary",
		qualified: "defillama.options.getOptionsSummary",
		sandboxImpl: lazyMethod("optionsService", "getOptionsSummaryRaw"),
		description:
			"Fetch detailed options-protocol volume data for a single protocol. Pass the canonical options-protocol slug from the DefiLlama catalog — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.options.getOptionsOverview().protocols` and filtering on `name`. Don't construct the slug by transforming a display name. Use `dataType` to choose premium vs notional volume.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Canonical options-protocol slug from the DefiLlama catalog (kebab-case). Get the exact value via `defillama.resolveProtocol(name)` or by reading the `slug` field off `defillama.options.getOptionsOverview().protocols` — never construct it by transforming a display name.",
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
			"const slug = await defillama.resolveProtocol(name); await defillama.options.getOptionsSummary({protocol: slug})",
	},
	{
		name: "defillama_get_options_overview",
		qualified: "defillama.options.getOptionsOverview",
		sandboxImpl: lazyMethod("optionsService", "getOptionsOverviewRaw"),
		description:
			"Fetch an options-volume overview across all options protocols, or scoped to one chain when `chain` is provided. Returns the full `protocols` array (sort/slice in your execute() script). Use the chain DISPLAY NAME from `defillama.resolveChain(input).name` (case-sensitive). This is also the canonical source for discovering valid options-protocol slugs — read the `slug` field off each entry.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name as returned by `defillama.resolveChain(input).name` or the `name` field of `defillama.protocol.getChains()`. Case-sensitive. If omitted, returns the global overview of all options protocols.",
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
			"const {name} = await defillama.resolveChain(input); await defillama.options.getOptionsOverview({chain: name})",
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
			"Fetch the historical stablecoin market-cap chart, optionally scoped to a chain and/or a single stablecoin. Returns the full series (slice the tail in your execute() script). Use the chain DISPLAY NAME from `defillama.resolveChain(input).name`; omit `chain` for global aggregated data. Stablecoin IDs are numeric and not derivable from symbols — discover via `defillama.resolveStablecoin(symbol)` or by reading the `id` field off `defillama.stablecoin.getStablecoins().peggedAssets`.",
		parameters: z.object({
			chain: z
				.string()
				.optional()
				.describe(
					"Chain display name as returned by `defillama.resolveChain(input).name` or the `name` field of `defillama.protocol.getChains()`. Case-sensitive. If omitted, returns global aggregated data across all chains.",
				),
			stablecoin: z
				.union([z.number().int(), z.string()])
				.optional()
				.describe(
					"Numeric stablecoin ID (a string of digits) as assigned by DefiLlama. Get it via `defillama.resolveStablecoin(symbol)` or by reading the `id` field off `defillama.stablecoin.getStablecoins().peggedAssets` — never invent it from a symbol or name.",
				),
		}),
		responseSchema: StablecoinChartsSchema,
		exampleCall:
			"const {name} = await defillama.resolveChain(input); const id = await defillama.resolveStablecoin(symbol); await defillama.stablecoin.getStablecoinCharts({chain: name, stablecoin: id})",
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
			"Fetch current token prices. Tokens are identified in the format `${chainSlug}:${tokenAddress}` — get `chainSlug` from `defillama.resolveChain(input).slug` (the LOWERCASE coins-API form, not the display name), and `tokenAddress` from the user, a wallet, or an on-chain explorer (there is no DefiLlama-side address discovery). Comma-separate multiple tokens. CoinGecko IDs use the `coingecko:<id>` prefix as a separate well-known shorthand.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `${chainSlug}:${tokenAddress}` format. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller. Native coins can use `coingecko:<id>` instead.",
				),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window to search for price data: a duration string (e.g. '4h', '1d', '30m') or seconds as a number (e.g. 600).",
				),
		}),
		responseSchema: CurrentPricesSchema,
		exampleCall:
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getCurrentPrices({coins: `${slug}:${tokenAddress}`})",
	},
	{
		name: "defillama_get_prices_first_coins",
		qualified: "defillama.price.getFirstPrices",
		sandboxImpl: lazyMethod("priceService", "getFirstPricesRaw"),
		description:
			"Fetch the first-ever recorded price for each token. Tokens are identified in the format `${chainSlug}:${tokenAddress}` — get `chainSlug` from `defillama.resolveChain(input).slug` and `tokenAddress` from the user, a wallet, or an on-chain explorer. Comma-separate multiple tokens. Useful for when a token was first listed/tracked.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `${chainSlug}:${tokenAddress}` format. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller.",
				),
		}),
		responseSchema: FirstPricesSchema,
		exampleCall:
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getFirstPrices({coins: `${slug}:${tokenAddress}`})",
	},
	{
		name: "defillama_get_batch_historical",
		qualified: "defillama.price.getBatchHistorical",
		sandboxImpl: lazyMethod("priceService", "getBatchHistoricalRaw"),
		description:
			"Fetch historical prices for many tokens at many timestamps in one call. `coins` is an object mapping `${chainSlug}:${tokenAddress}` to an array of Unix timestamps in seconds. Get each `chainSlug` via `defillama.resolveChain(input).slug` and each `tokenAddress` from the user/wallet/explorer. A pre-encoded string is also accepted.",
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
					"Object mapping `${chainSlug}:${tokenAddress}` to an array of Unix timestamps in seconds. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller. Native coins can use `coingecko:<id>`. A pre-encoded string is also accepted.",
				),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window around each timestamp: a duration string (e.g. '6h', '1d') or seconds as a number (e.g. 600).",
				),
		}),
		responseSchema: BatchHistoricalSchema,
		exampleCall:
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getBatchHistorical({coins: {[`${slug}:${tokenAddress}`]: [timestamp]}})",
	},
	{
		name: "defillama_get_historical_prices_by_contract",
		qualified: "defillama.price.getHistoricalPrices",
		sandboxImpl: lazyMethod("priceService", "getHistoricalPricesRaw"),
		description:
			"Fetch token prices at a single point in time. Tokens are identified in the format `${chainSlug}:${tokenAddress}` — get `chainSlug` from `defillama.resolveChain(input).slug` and `tokenAddress` from the user/wallet/explorer. Comma-separate multiple tokens. `timestamp` accepts Unix seconds or an ISO 8601 date string.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `${chainSlug}:${tokenAddress}` format. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller.",
				),
			timestamp: unixTimestampArg().describe(
				"Point in time to query. Unix timestamp in seconds (e.g. `Math.floor(targetDate.getTime()/1000)`) or ISO 8601 (e.g. '2024-01-15T12:00:00Z').",
			),
			searchWidth: searchWidthArg()
				.optional()
				.describe(
					"Time window around the timestamp: a duration string (e.g. '6h', '1d') or seconds as a number.",
				),
		}),
		responseSchema: CurrentPricesSchema,
		exampleCall:
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getHistoricalPrices({coins: `${slug}:${tokenAddress}`, timestamp})",
	},
	{
		name: "defillama_get_percentage_coins",
		qualified: "defillama.price.getPercentageChange",
		sandboxImpl: lazyMethod("priceService", "getPercentageChangeRaw"),
		description:
			"Fetch the percentage price change for tokens over a period, looking backward (default) or forward. Tokens are `${chainSlug}:${tokenAddress}` — get `chainSlug` from `defillama.resolveChain(input).slug` and `tokenAddress` from the user/wallet/explorer. Comma-separate multiple tokens.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `${chainSlug}:${tokenAddress}` format. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller.",
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
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getPercentageChange({coins: `${slug}:${tokenAddress}`, period: '7d'})",
	},
	{
		name: "defillama_get_chart_coins",
		qualified: "defillama.price.getPriceChart",
		sandboxImpl: lazyMethod("priceService", "getPriceChartRaw"),
		description:
			"Fetch a historical price chart (time series) for one or more tokens. Tokens are `${chainSlug}:${tokenAddress}` — get `chainSlug` from `defillama.resolveChain(input).slug` and `tokenAddress` from the user/wallet/explorer. Native coins can use `coingecko:<id>`. Control the range and granularity with start/end/span/period.",
		parameters: z.object({
			coins: z
				.string()
				.describe(
					"Comma-separated tokens in `${chainSlug}:${tokenAddress}` format. `chainSlug` comes from `defillama.resolveChain(input).slug`; `tokenAddress` is supplied by the user/caller. Native coins can use `coingecko:<id>`.",
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
			"const {slug} = await defillama.resolveChain(input); await defillama.price.getPriceChart({coins: `${slug}:${tokenAddress}`, span: 10, period: '1d'})",
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
			"Fetch the historical APY/TVL series for a single yield pool. Returns the full series (slice the tail in your execute() script). Pool UUIDs are opaque DefiLlama identifiers and not derivable from any human-readable field — always discover by calling `defillama.yield.getLatestPools()` first and reading the `pool` field off the entry that matches your `project` + `symbol` + `chain`.",
		parameters: z.object({
			pool: z
				.string()
				.describe(
					"Opaque UUID assigned by DefiLlama to a yield pool, as returned in the `pool` field of `defillama.yield.getLatestPools().data`. There is no way to construct this from project/symbol/chain — discover it from the pool list first.",
				),
		}),
		responseSchema: HistoricalPoolSchema,
		exampleCall:
			"const pools = await defillama.yield.getLatestPools(); const id = pools.data.find(p => /* match on project/symbol/chain */).pool; await defillama.yield.getHistoricalPoolData({pool: id})",
	},
	// ── Blockchain (coins.llama.fi) ────────────────────────────────────────
	{
		name: "defillama_get_blockchain_timestamp",
		qualified: "defillama.blockchain.getBlockAtTimestamp",
		sandboxImpl: lazyMethod("blockchainService", "getBlockAtTimestampRaw"),
		description:
			"Resolve the block (height + timestamp) closest to a given time on a chain. Essential for historical queries that need a block number. This is a coins.llama.fi endpoint and expects the LOWERCASE chain SLUG (not the display name) — get it from `defillama.resolveChain(input).slug`. `timestamp` accepts Unix seconds or an ISO 8601 date string.",
		parameters: z.object({
			chain: z
				.string()
				.describe(
					"Lowercase chain slug for the coins.llama.fi endpoint, as returned by `defillama.resolveChain(input).slug`. This is the chain display name lowercased — do not pass the display-name form here.",
				),
			timestamp: unixTimestampArg().describe(
				"Time to query. Unix timestamp in seconds (e.g. `Math.floor(Date.now()/1000)`) or ISO 8601 date string (e.g. '2024-01-15T10:30:00Z').",
			),
		}),
		responseSchema: BlockSchema,
		exampleCall:
			"const {slug} = await defillama.resolveChain(input); await defillama.blockchain.getBlockAtTimestamp({chain: slug, timestamp: Math.floor(Date.now()/1000)})",
	},
];
