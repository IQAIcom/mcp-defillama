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
			"Broad list of every chain DefiLlama tracks (~200 entries with current TVL). Use for cross-chain aggregate queries (TVL leaderboards, chain discovery) or as the resolver fallback. For 'what is X chain's TVL', prefer `defillama.resolveChain(input)` → `getHistoricalChainTvl({chain})` instead. Read `name` for api.llama.fi endpoints; lowercase the same value for coins.llama.fi. ALWAYS sort/filter/project inside the `execute()` sandbox — never return the raw catalog.",
		parameters: z.object({}),
		responseSchema: ChainsSchema,
		exampleCall:
			"const chains = await defillama.protocol.getChains(); return [...chains].sort((a,b) => (b.tvl ?? 0) - (a.tvl ?? 0)).slice(0, 20).map(c => ({name: c.name, tvl: c.tvl}))",
	},
	{
		name: "defillama_get_protocols",
		qualified: "defillama.protocol.getProtocols",
		sandboxImpl: lazyMethod("protocolService", "getProtocolsRaw"),
		description:
			"Returns the FULL DefiLlama protocol catalog (~3k entries, several MB of JSON). Use ONLY for cross-protocol aggregate queries (leaderboards, category rollups, by-chain counts) or as the discovery fallback when `defillama.resolveProtocol(name)` returns null. For a single-protocol question ('what is X's TVL?'), prefer the resolver → `getProtocol({protocol: slug})` path — calling this endpoint and returning the raw response blows the agent's context. ALWAYS project/filter/sort/slice inside the `execute()` sandbox before returning.",
		parameters: z.object({}),
		responseSchema: ProtocolsSchema,
		exampleCall:
			"const protocols = await defillama.protocol.getProtocols(); return [...protocols].sort((a,b) => (b.tvl ?? 0) - (a.tvl ?? 0)).slice(0, 20).map(p => ({slug: p.slug, name: p.name, tvl: p.tvl, chains: p.chains, change_7d: p.change_7d}))",
	},
	{
		name: "defillama_get_protocol",
		qualified: "defillama.protocol.getProtocol",
		sandboxImpl: lazyMethod("protocolService", "getProtocolRaw"),
		description:
			"Narrow endpoint for a SINGLE protocol's TVL, per-chain breakdown, and historical series. Preferred over `getProtocols()` for any 'what is X' question. The response is large (per-chain breakdowns + full historical TVL series); pluck the fields you actually need rather than returning the whole object. Pass the canonical kebab-case slug from the DefiLlama catalog — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.protocol.getProtocols()` and filtering on `name` (see the find-protocol-slug recipe). Slugs are NOT derivable from display names.",
		parameters: z.object({
			protocol: z
				.string()
				.describe(
					"Canonical protocol slug from the DefiLlama catalog (kebab-case). Get the exact value via `defillama.resolveProtocol(name)` or by enumerating `defillama.protocol.getProtocols()` and filtering on `name` — never construct it by transforming a display name.",
				),
		}),
		responseSchema: ProtocolSchema,
		exampleCall:
			"const slug = await defillama.resolveProtocol(name); if (!slug) return { error: 'Protocol not found' }; const p = await defillama.protocol.getProtocol({protocol: slug}); const last = p.tvl?.at(-1); return { name: p.name, currentTvl: last?.totalLiquidityUSD, asOf: last?.date ? new Date(last.date * 1000).toISOString() : undefined, chains: p.chains }",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const series = await defillama.protocol.getHistoricalChainTvl({chain: chain.name}); return series.slice(-90).map(p => ({date: new Date(p.date * 1000).toISOString() /* p.date is Unix seconds; multiply by 1000 for JS Date */, tvl: p.tvl}))",
	},
	// ── DEX (api.llama.fi) ─────────────────────────────────────────────────
	{
		name: "defillama_get_dex_summary",
		qualified: "defillama.dex.getDexSummary",
		sandboxImpl: lazyMethod("dexService", "getDexSummaryRaw"),
		description:
			"Narrow endpoint for a SINGLE DEX protocol's trading volume. Response has 30+ fields covering totals (24h/7d/30d/all-time), percentage changes, per-chain breakdowns, and (optionally) the volume chart series — pluck the specific fields you need rather than returning the whole object. Pass the canonical kebab-case DEX slug — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.dex.getDexsOverview().protocols` and filtering on `name`. Slugs are NOT derivable from display names. Each catalog (DEX, revenue, options) has its own slug namespace — a slug valid in one may not exist in another.",
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
			"const slug = await defillama.resolveProtocol(name); if (!slug) return { error: 'Protocol not found' }; const s = await defillama.dex.getDexSummary({protocol: slug}); return { name: s.name, total24h: s.total24h, total7d: s.total7d, total30d: s.total30d, totalAllTime: s.totalAllTime, change_1d: s.change_1d, change_7d: s.change_7d }",
	},
	{
		name: "defillama_get_dexs_overview",
		qualified: "defillama.dex.getDexsOverview",
		sandboxImpl: lazyMethod("dexService", "getDexsOverviewRaw"),
		description:
			"Broad overview of DEX volume across all DEXs, or scoped to one chain. Returns a large `protocols` array — use for leaderboards, cross-DEX comparisons, or as the canonical source for discovering valid DEX slugs (`slug` field on each entry). For a single-DEX question, prefer the resolver → `getDexSummary({protocol: slug})` path. ALWAYS sort/filter/project inside the `execute()` sandbox before returning; never return the raw response.",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const overview = await defillama.dex.getDexsOverview({chain: chain.name}); return [...(overview.protocols ?? [])].sort((a,b) => (b.total24h ?? 0) - (a.total24h ?? 0)).slice(0, 20).map(p => ({slug: p.slug, name: p.name, total24h: p.total24h, change_7d: p.change_7d}))",
	},
	// ── Fees & Revenue (api.llama.fi) ──────────────────────────────────────
	{
		name: "defillama_get_fees_summary",
		qualified: "defillama.fees.getFeesSummary",
		sandboxImpl: lazyMethod("feesService", "getFeesSummaryRaw"),
		description:
			"Narrow endpoint for a SINGLE protocol's fees/revenue. Response includes totals (24h/7d/30d/all-time), per-chain breakdowns, and (optionally) the daily chart series — pluck the specific fields you need rather than returning the whole object. The fees catalog often uses version-suffixed slugs (one display name like 'Uniswap' maps to multiple fees-tracked deployments such as `uniswap-v2`, `uniswap-v3`, `uniswap-labs`), so discovery is required — use `defillama.resolveProtocol(name)` or enumerate `defillama.fees.getFeesOverview().protocols` and filter on `name`. Don't pass an unversioned display-name guess. Use `dataType` to choose which metric series to return.",
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
			"const slug = await defillama.resolveProtocol(name); if (!slug) return { error: 'Protocol not found' }; const s = await defillama.fees.getFeesSummary({protocol: slug, dataType: 'dailyRevenue'}); return { name: s.name, total24h: s.total24h, total7d: s.total7d, total30d: s.total30d, totalAllTime: s.totalAllTime, change_1d: s.change_1d, change_7d: s.change_7d }",
	},
	{
		name: "defillama_get_fees_overview",
		qualified: "defillama.fees.getFeesOverview",
		sandboxImpl: lazyMethod("feesService", "getFeesOverviewRaw"),
		description:
			"Broad overview of protocol fees/revenue across all chains, or scoped to one chain. Returns a large `protocols` array — use for leaderboards, cross-protocol comparisons, or as the canonical source for discovering valid fees-protocol slugs (`slug` field on each entry). For a single-protocol question, prefer the resolver → `getFeesSummary({protocol: slug})` path. ALWAYS sort/filter/project inside the `execute()` sandbox before returning; never return the raw response.",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const overview = await defillama.fees.getFeesOverview({chain: chain.name, dataType: 'dailyFees'}); return [...(overview.protocols ?? [])].sort((a,b) => (b.total24h ?? 0) - (a.total24h ?? 0)).slice(0, 20).map(p => ({slug: p.slug, name: p.name, total24h: p.total24h, change_7d: p.change_7d}))",
	},
	// ── Options (api.llama.fi) ─────────────────────────────────────────────
	{
		name: "defillama_get_options_summary",
		qualified: "defillama.options.getOptionsSummary",
		sandboxImpl: lazyMethod("optionsService", "getOptionsSummaryRaw"),
		description:
			"Narrow endpoint for a SINGLE options protocol's volume. Response includes totals (24h/7d/30d/all-time), per-chain breakdowns, and (optionally) chart series — pluck the specific fields you need rather than returning the whole object. Pass the canonical options-protocol slug — discover via `defillama.resolveProtocol(name)` or by enumerating `defillama.options.getOptionsOverview().protocols` and filtering on `name`. Don't construct the slug by transforming a display name. Use `dataType` to choose premium vs notional volume.",
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
			"const slug = await defillama.resolveProtocol(name); if (!slug) return { error: 'Protocol not found' }; const s = await defillama.options.getOptionsSummary({protocol: slug}); return { name: s.name, total24h: s.total24h, total7d: s.total7d, totalAllTime: s.totalAllTime, change_7d: s.change_7d }",
	},
	{
		name: "defillama_get_options_overview",
		qualified: "defillama.options.getOptionsOverview",
		sandboxImpl: lazyMethod("optionsService", "getOptionsOverviewRaw"),
		description:
			"Broad overview of options-protocol volume across all chains, or scoped to one chain. Returns a large `protocols` array — use for leaderboards or as the canonical source for discovering valid options-protocol slugs (`slug` field on each entry). For a single-protocol question, prefer the resolver → `getOptionsSummary({protocol: slug})` path. ALWAYS sort/filter/project inside the `execute()` sandbox before returning; never return the raw response.",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const overview = await defillama.options.getOptionsOverview({chain: chain.name}); return [...(overview.protocols ?? [])].sort((a,b) => (b.total24h ?? 0) - (a.total24h ?? 0)).slice(0, 20).map(p => ({slug: p.slug, name: p.name, total24h: p.total24h, change_7d: p.change_7d}))",
	},
	// ── Stablecoins (stablecoins.llama.fi) ─────────────────────────────────
	{
		name: "defillama_get_stablecoin",
		qualified: "defillama.stablecoin.getStablecoins",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinsRaw"),
		description:
			"Broad list of all stablecoins with circulation data (optionally current prices). Returns a large `peggedAssets` array — use for leaderboards or as the canonical source for discovering stablecoin IDs (`id` field). For a single-stablecoin question, prefer `defillama.resolveStablecoin(symbol)` → `getStablecoinCharts({stablecoin: id})`. ALWAYS sort/filter/project inside the `execute()` sandbox before returning; never return the raw response.",
		parameters: z.object({
			includePrices: z
				.boolean()
				.optional()
				.describe("Include current price data for each stablecoin."),
		}),
		responseSchema: StablecoinsSchema,
		exampleCall:
			"const res = await defillama.stablecoin.getStablecoins({includePrices: true}); return (res.peggedAssets ?? []).slice(0, 20).map(s => ({id: s.id, symbol: s.symbol, name: s.name, circulating: s.circulating?.peggedUSD /* upstream wraps as {peggedUSD: n}; unwrap for a flat numeric */, price: s.price}))",
	},
	{
		name: "defillama_get_stablecoin_chains",
		qualified: "defillama.stablecoin.getStablecoinChains",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinChainsRaw"),
		description:
			"Stablecoin market-cap totals broken down by chain. Returns the full array — slice/sort/project inside the `execute()` sandbox; don't return the raw response.",
		parameters: z.object({}),
		responseSchema: StablecoinChainsSchema,
		exampleCall:
			"const rows = await defillama.stablecoin.getStablecoinChains(); return rows.slice(0, 30).map(r => ({name: r.name, total: r.totalCirculatingUSD?.peggedUSD /* upstream wraps as {peggedUSD: n}; unwrap for a flat numeric */}))",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const id = await defillama.resolveStablecoin(symbol); if (!id) return { error: 'Stablecoin not found' }; const series = await defillama.stablecoin.getStablecoinCharts({chain: chain.name, stablecoin: id}); return series.slice(-90).map(p => ({date: new Date(p.date * 1000).toISOString() /* p.date is Unix seconds; multiply by 1000 for JS Date */, totalCirculatingUSD: p.totalCirculatingUSD}))",
	},
	{
		name: "defillama_get_stablecoin_prices",
		qualified: "defillama.stablecoin.getStablecoinPrices",
		sandboxImpl: lazyMethod("stablecoinService", "getStablecoinPricesRaw"),
		description:
			"Historical stablecoin price series across all tracked assets. Returns a large time series — slice the tail (or project per-asset) inside the `execute()` sandbox; don't return the raw response.",
		parameters: z.object({}),
		responseSchema: StablecoinPricesSchema,
		exampleCall:
			"const series = await defillama.stablecoin.getStablecoinPrices(); return series.slice(-90).map(p => ({date: new Date(p.date * 1000).toISOString() /* p.date is Unix seconds; multiply by 1000 for JS Date */, prices: p.prices}))",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getCurrentPrices({coins: key}); return res.coins?.[key]?.price",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getFirstPrices({coins: key}); return res.coins?.[key]",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getBatchHistorical({coins: {[key]: [timestamp]}}); return res.coins?.[key]?.prices",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getHistoricalPrices({coins: key, timestamp}); return res.coins?.[key]",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getPercentageChange({coins: key, period: '7d'}); return res.coins?.[key]",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; const key = `${chain.slug}:${tokenAddress}`; const res = await defillama.price.getPriceChart({coins: key, span: 30, period: '1d'}); return res.coins?.[key]?.prices ?? []",
	},
	// ── Yields (yields.llama.fi) ───────────────────────────────────────────
	{
		name: "defillama_get_latest_pool_data",
		qualified: "defillama.yield.getLatestPools",
		sandboxImpl: lazyMethod("yieldService", "getLatestPoolsRaw"),
		description:
			"Broad list of every current yield-farming pool with APY, TVL and reward metrics. The `data` array is large (thousands of pools across all chains/protocols) — use for cross-pool screens, leaderboards, or as the catalog for discovering the `pool` UUID before calling `getHistoricalPoolData`. ALWAYS filter (by chain/project/symbol/apy threshold) + sort + slice + project inside the `execute()` sandbox; never return the raw response.",
		parameters: z.object({}),
		responseSchema: PoolsSchema,
		exampleCall:
			"const pools = await defillama.yield.getLatestPools(); return [...(pools.data ?? [])].sort((a,b) => (b.apy ?? 0) - (a.apy ?? 0)).slice(0, 20).map(p => ({pool: p.pool, project: p.project, symbol: p.symbol, chain: p.chain, apy: p.apy, tvlUsd: p.tvlUsd}))",
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
			"const pools = await defillama.yield.getLatestPools(); const id = (pools.data ?? []).find(p => p.project === projectInput && p.symbol === symbolInput && p.chain === chainInput)?.pool; if (!id) return { error: 'Pool not found' }; const series = await defillama.yield.getHistoricalPoolData({pool: id}); return (series.data ?? []).slice(-90).map(p => ({timestamp: p.timestamp /* already an ISO string, unlike the date:number fields on /v2 endpoints */, apy: p.apy, tvlUsd: p.tvlUsd}))",
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
			"const chain = await defillama.resolveChain(input); if (!chain) return { error: 'Chain not found' }; return await defillama.blockchain.getBlockAtTimestamp({chain: chain.slug, timestamp: Math.floor(Date.now()/1000)})",
	},
];
