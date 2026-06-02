import { z } from "zod";

// ============================================================================
// Protocol & TVL Schemas
// ============================================================================

/**
 * Schema for ChainData[] — /v2/chains
 */
export const ChainsSchema = z.array(
	z
		.object({
			name: z.string(),
			tvl: z.number(),
			gecko_id: z.string().nullable().optional(),
			tokenSymbol: z.string().nullable().optional(),
			cmcId: z.string().nullable().optional(),
			chainId: z.number().nullable().optional(),
		})
		.catchall(z.unknown()),
);

/**
 * Schema for ProtocolData[] — /protocols
 */
export const ProtocolsSchema = z.array(
	z
		.object({
			id: z.string(),
			name: z.string(),
			symbol: z.string(),
			category: z.string(),
			chains: z.array(z.string()),
			tvl: z.number(),
			chainTvls: z.record(z.string(), z.number()).optional(),
			change_1h: z.number().optional(),
			change_1d: z.number().optional(),
			change_7d: z.number().optional(),
			currentChainTvls: z.record(z.string(), z.number()).optional(),
			mcap: z.number().optional(),
		})
		.catchall(z.unknown()),
);

/**
 * Schema for ProtocolData (single) — /protocol/{protocol}
 */
export const ProtocolSchema = z
	.object({
		id: z.string().optional(),
		name: z.string().optional(),
		symbol: z.string().optional(),
		category: z.string().optional(),
		chains: z.array(z.string()).optional(),
		tvl: z.number().optional(),
		chainTvls: z.record(z.string(), z.unknown()).optional(),
		change_1h: z.number().optional(),
		change_1d: z.number().optional(),
		change_7d: z.number().optional(),
		currentChainTvls: z.record(z.string(), z.number()).optional(),
		mcap: z.number().optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for HistoricalChainTvlItem[] — /v2/historicalChainTvl[/{chain}]
 */
export const HistoricalChainTvlSchema = z.array(
	z
		.object({
			date: z.number(),
			tvl: z.number(),
		})
		.catchall(z.unknown()),
);

// ============================================================================
// DEX Schemas
// ============================================================================

const DexProtocolDataSchema = z
	.object({
		name: z.string(),
		displayName: z.string().optional(),
		total24h: z.number().optional(),
		total7d: z.number().optional(),
		change_1d: z.number().optional(),
		change_7d: z.number().optional(),
		chains: z.array(z.string()).optional(),
		breakdown24h: z.record(z.string(), z.number()).optional(),
		dailyVolume: z.number().optional(),
		total30d: z.number().optional(),
		change_1m: z.number().optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for DexSummaryResponse — /summary/dexs/{protocol}
 */
export const DexSummarySchema = z
	.object({
		name: z.string(),
		total24h: z.number(),
		totalAllTime: z.number().optional(),
		totalDataChart: z.array(z.tuple([z.number(), z.number()])).optional(),
		totalDataChartBreakdown: z
			.array(z.tuple([z.number(), z.record(z.string(), z.number())]))
			.optional(),
		chains: z.array(z.string()).optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for DexOverviewResponse — /overview/dexs[/{chain}]
 */
export const DexOverviewSchema = z
	.object({
		protocols: z.array(DexProtocolDataSchema).optional(),
		totalDataChart: z.array(z.tuple([z.number(), z.number()])).optional(),
		totalDataChartBreakdown: z
			.array(z.tuple([z.number(), z.record(z.string(), z.unknown())]))
			.optional(),
		allChains: z.array(z.string()).optional(),
	})
	.catchall(z.unknown());

// ============================================================================
// Fees Schemas
// ============================================================================

const FeesProtocolDataSchema = z
	.object({
		name: z.string(),
		total24h: z.number().optional(),
		revenue24h: z.number().optional(),
		change_1d: z.number().optional(),
		change_7d: z.number().optional(),
		change_1m: z.number().optional(),
		chains: z.array(z.string()).optional(),
		dailyUserFees: z.number().optional(),
		dailyHoldersRevenue: z.number().optional(),
		dailySupplySideRevenue: z.number().optional(),
		holdersRevenue30d: z.number().optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for FeesSummaryResponse — /summary/fees/{protocol}
 */
export const FeesSummarySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		url: z.string().optional(),
		referralUrl: z.string().optional(),
		description: z.string().optional(),
		logo: z.string().optional(),
		gecko_id: z.string().optional(),
		cmcId: z.string().optional(),
		chains: z.array(z.string()).optional(),
		twitter: z.string().optional(),
		github: z.array(z.string()).optional(),
		symbol: z.string().optional(),
		address: z.string().optional(),
		defillamaId: z.string().optional(),
		disabled: z.boolean().nullable().optional(),
		displayName: z.string().optional(),
		module: z.string().nullable().optional(),
		category: z.string().nullable().optional(),
		methodologyURL: z.string().nullable().optional(),
		methodology: z.record(z.string(), z.unknown()).nullable().optional(),
		slug: z.string().optional(),
		protocolType: z.string().optional(),
		total24h: z.number().optional(),
		total48hto24h: z.number().optional(),
		total7d: z.number().optional(),
		totalAllTime: z.number().optional(),
		change_1d: z.number().optional(),
		totalDataChart: z.array(z.tuple([z.number(), z.number()])).optional(),
		totalDataChartBreakdown: z
			.array(
				z.tuple([
					z.number(),
					z.record(z.string(), z.record(z.string(), z.number())),
				]),
			)
			.optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for FeesOverviewResponse — /overview/fees[/{chain}]
 */
export const FeesOverviewSchema = z
	.object({
		protocols: z.array(FeesProtocolDataSchema).optional(),
		totalDataChart: z.array(z.tuple([z.number(), z.number()])).optional(),
		totalDataChartBreakdown: z
			.array(z.tuple([z.number(), z.record(z.string(), z.number())]))
			.optional(),
	})
	.catchall(z.unknown());

// ============================================================================
// Options Schemas
// ============================================================================

const OptionsProtocolDataSchema = z
	.object({
		name: z.string(),
		displayName: z.string().optional(),
		disabled: z.boolean().optional(),
		totalNotionalVolume: z.number().optional(),
		totalPremiumVolume: z.number().optional(),
		dailyNotionalVolume: z.number().optional(),
		dailyPremiumVolume: z.number().optional(),
		change_1d: z.number().optional(),
		change_7d: z.number().optional(),
		change_1m: z.number().optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for OptionsSummaryResponse — /summary/options/{protocol}
 */
export const OptionsSummarySchema = z
	.object({
		id: z.string().optional(),
		name: z.string().optional(),
		displayName: z.string().optional(),
		chains: z.array(z.string()).optional(),
		total24h: z.number().optional(),
		total7d: z.number().optional(),
		total30d: z.number().optional(),
		totalAllTime: z.number().optional(),
		change_1d: z.number().optional(),
		change_7d: z.number().optional(),
		change_1m: z.number().optional(),
		totalDataChart: z.array(z.tuple([z.number(), z.number()])).optional(),
		totalDataChartBreakdown: z
			.array(z.tuple([z.number(), z.record(z.string(), z.unknown())]))
			.optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for OptionsOverviewResponse — /overview/options[/{chain}]
 */
export const OptionsOverviewSchema = z
	.object({
		protocols: z.array(OptionsProtocolDataSchema).optional(),
		totalDataChart: z.array(z.record(z.string(), z.unknown())).optional(),
	})
	.catchall(z.unknown());

// ============================================================================
// Stablecoin Schemas
// ============================================================================

const StablecoinCirculatingSchema = z
	.object({
		peggedUSD: z.number(),
	})
	.catchall(z.unknown());

const StablecoinChainCirculatingSchema = z
	.object({
		current: StablecoinCirculatingSchema,
	})
	.catchall(z.unknown());

const StablecoinDataSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		symbol: z.string(),
		pegType: z.string(),
		pegMechanism: z.string(),
		circulating: StablecoinCirculatingSchema,
		chains: z.array(z.string()).optional(),
		chainCirculating: z
			.record(z.string(), StablecoinChainCirculatingSchema)
			.optional(),
		price: z.number().optional(),
		circulatingPrevDay: z.record(z.string(), z.number()).optional(),
		circulatingPrevWeek: z.record(z.string(), z.number()).optional(),
		circulatingPrevMonth: z.record(z.string(), z.number()).optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for StablecoinsResponse — /stablecoins
 */
export const StablecoinsSchema = z
	.object({
		peggedAssets: z.array(StablecoinDataSchema),
	})
	.catchall(z.unknown());

/**
 * Schema for StablecoinChainItem[] — /stablecoinchains
 */
export const StablecoinChainsSchema = z.array(
	z
		.object({
			name: z.string(),
			/*
			 * Live /stablecoinchains returns `totalCirculatingUSD: { peggedUSD }`
			 * per chain (verified against the live API); there is no
			 * `totalCirculating` key on this endpoint.
			 */
			totalCirculatingUSD: z
				.object({
					peggedUSD: z.number(),
				})
				.catchall(z.unknown()),
		})
		.catchall(z.unknown()),
);

/**
 * Schema for StablecoinChartItem[] — /stablecoincharts/{chain|all}
 */
export const StablecoinChartsSchema = z.array(
	z
		.object({
			date: z.number(),
			totalCirculating: z
				.object({
					peggedUSD: z.number(),
				})
				.catchall(z.unknown()),
			totalUnreleased: z.record(z.string(), z.number()).optional(),
			totalCirculatingUSD: z.number().optional(),
			totalMintedUSD: z.number().optional(),
			totalBridgedToUSD: z.number().optional(),
		})
		.catchall(z.unknown()),
);

/**
 * Schema for StablecoinPriceItem[] — /stablecoinprices
 */
export const StablecoinPricesSchema = z.array(
	z
		.object({
			date: z.number(),
			prices: z.record(z.string(), z.number()),
		})
		.catchall(z.unknown()),
);

// ============================================================================
// Price (Coins) Schemas
// ============================================================================

const CurrentCoinPriceSchema = z
	.object({
		decimals: z.number(),
		price: z.number(),
		symbol: z.string(),
		timestamp: z.number(),
		confidence: z.number().optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for CurrentPricesResponse — /prices/current/{coins} and /prices/historical/{ts}/{coins}
 */
export const CurrentPricesSchema = z
	.object({
		coins: z.record(z.string(), CurrentCoinPriceSchema),
	})
	.catchall(z.unknown());

const FirstCoinPriceSchema = z
	.object({
		price: z.number(),
		symbol: z.string(),
		timestamp: z.number(),
	})
	.catchall(z.unknown());

/**
 * Schema for FirstPricesResponse — /prices/first/{coins}
 */
export const FirstPricesSchema = z
	.object({
		coins: z.record(z.string(), FirstCoinPriceSchema),
	})
	.catchall(z.unknown());

const HistoricalPricePointSchema = z
	.object({
		timestamp: z.number(),
		price: z.number(),
		confidence: z.number(),
	})
	.catchall(z.unknown());

const BatchHistoricalCoinDataSchema = z
	.object({
		symbol: z.string(),
		prices: z.array(HistoricalPricePointSchema),
	})
	.catchall(z.unknown());

/**
 * Schema for BatchHistoricalResponse — /batchHistorical
 */
export const BatchHistoricalSchema = z
	.object({
		coins: z.record(z.string(), BatchHistoricalCoinDataSchema),
	})
	.catchall(z.unknown());

/**
 * Schema for PercentageResponse — /percentage/{coins}
 */
export const PercentageSchema = z
	.object({
		coins: z.record(z.string(), z.number()),
	})
	.catchall(z.unknown());

const ChartPricePointSchema = z
	.object({
		timestamp: z.number(),
		price: z.number(),
	})
	.catchall(z.unknown());

const ChartCoinDataSchema = z
	.object({
		decimals: z.number(),
		confidence: z.number(),
		prices: z.array(ChartPricePointSchema),
		symbol: z.string(),
	})
	.catchall(z.unknown());

/**
 * Schema for ChartResponse — /chart/{coins}
 */
export const PriceChartSchema = z
	.object({
		coins: z.record(z.string(), ChartCoinDataSchema),
	})
	.catchall(z.unknown());

// ============================================================================
// Yield Schemas
// ============================================================================

const PoolDataSchema = z
	.object({
		pool: z.string(),
		chain: z.string(),
		project: z.string(),
		symbol: z.string(),
		tvlUsd: z.number(),
		apy: z.number(),
		apyBase: z.number().optional(),
		apyReward: z.number().optional(),
		rewardTokens: z.array(z.string()).optional(),
		underlyingTokens: z.array(z.string()).optional(),
		poolMeta: z.string().optional(),
		url: z.string().optional(),
		predictions: z
			.object({
				predictedClass: z.string(),
				predictedProbability: z.number(),
				binnedConfidence: z.number(),
			})
			.catchall(z.unknown())
			.optional(),
	})
	.catchall(z.unknown());

/**
 * Schema for PoolsResponse — /pools
 */
export const PoolsSchema = z
	.object({
		status: z.string(),
		data: z.array(PoolDataSchema),
	})
	.catchall(z.unknown());

const HistoricalPoolItemSchema = z
	.object({
		timestamp: z.string(),
		tvlUsd: z.number(),
		apy: z.number(),
		apyBase: z.number(),
		apyReward: z.number(),
	})
	.catchall(z.unknown());

/**
 * Schema for HistoricalPoolResponse — /chart/{pool}
 */
export const HistoricalPoolSchema = z
	.object({
		data: z.array(HistoricalPoolItemSchema),
	})
	.catchall(z.unknown());

// ============================================================================
// Blockchain Schema
// ============================================================================

/**
 * Schema for BlockResponse — /block/{chain}/{timestamp}
 */
export const BlockSchema = z
	.object({
		height: z.number().optional(),
		timestamp: z.number().optional(),
	})
	.catchall(z.unknown());
