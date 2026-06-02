import { describe, expect, it } from "vitest";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that an extra unknown key survives .parse() — proving passthrough. */
function assertPassthrough<T extends object>(
	parsed: T,
	extraKey: string,
	extraValue: unknown,
) {
	expect((parsed as Record<string, unknown>)[extraKey]).toEqual(extraValue);
}

// ---------------------------------------------------------------------------
// ChainsSchema
// ---------------------------------------------------------------------------

describe("ChainsSchema", () => {
	const payload = [
		{
			name: "Ethereum",
			tvl: 45_000_000_000,
			gecko_id: "ethereum",
			tokenSymbol: "ETH",
			cmcId: "1027",
			chainId: 1,
		},
		{
			name: "BSC",
			tvl: 5_000_000_000,
			gecko_id: null,
			tokenSymbol: "BNB",
			cmcId: "1839",
			chainId: 56,
		},
	];

	it("parses a representative full payload", () => {
		const result = ChainsSchema.parse(payload);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Ethereum");
		expect(result[0].tvl).toBe(45_000_000_000);
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [{ name: "Ethereum", tvl: 1, _internal: "secret" }];
		const result = ChainsSchema.parse(withExtra);
		assertPassthrough(result[0], "_internal", "secret");
	});
});

// ---------------------------------------------------------------------------
// ProtocolsSchema
// ---------------------------------------------------------------------------

describe("ProtocolsSchema", () => {
	const payload = [
		{
			id: "1",
			name: "Lido",
			symbol: "LDO",
			category: "Liquid Staking",
			chains: ["Ethereum"],
			tvl: 20_000_000_000,
			chainTvls: { Ethereum: 20_000_000_000 },
			change_1h: 0.1,
			change_1d: -0.5,
			change_7d: 2.3,
		},
	];

	it("parses a representative full payload", () => {
		const result = ProtocolsSchema.parse(payload);
		expect(result[0].name).toBe("Lido");
		expect(result[0].chains).toContain("Ethereum");
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [
			{
				id: "2",
				name: "Aave",
				symbol: "AAVE",
				category: "Lending",
				chains: ["Ethereum"],
				tvl: 5_000_000_000,
				newProp: "future-field",
			},
		];
		const result = ProtocolsSchema.parse(withExtra);
		assertPassthrough(result[0], "newProp", "future-field");
	});
});

// ---------------------------------------------------------------------------
// ProtocolSchema (single)
// ---------------------------------------------------------------------------

describe("ProtocolSchema", () => {
	const payload = {
		id: "1",
		name: "Lido",
		symbol: "LDO",
		category: "Liquid Staking",
		chains: ["Ethereum"],
		tvl: 20_000_000_000,
		currentChainTvls: { Ethereum: 20_000_000_000 },
		mcap: 1_500_000_000,
	};

	it("parses a representative full payload", () => {
		const result = ProtocolSchema.parse(payload);
		expect(result.name).toBe("Lido");
		expect(result.tvl).toBe(20_000_000_000);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, extraField: "extra-value" };
		const result = ProtocolSchema.parse(withExtra);
		assertPassthrough(result, "extraField", "extra-value");
	});
});

// ---------------------------------------------------------------------------
// HistoricalChainTvlSchema
// ---------------------------------------------------------------------------

describe("HistoricalChainTvlSchema", () => {
	const payload = [
		{ date: 1_609_459_200, tvl: 10_000_000_000 },
		{ date: 1_612_137_600, tvl: 12_000_000_000 },
	];

	it("parses a representative full payload", () => {
		const result = HistoricalChainTvlSchema.parse(payload);
		expect(result).toHaveLength(2);
		expect(result[0].date).toBe(1_609_459_200);
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [{ date: 1_609_459_200, tvl: 1, extra: true }];
		const result = HistoricalChainTvlSchema.parse(withExtra);
		assertPassthrough(result[0], "extra", true);
	});
});

// ---------------------------------------------------------------------------
// DexSummarySchema
// ---------------------------------------------------------------------------

describe("DexSummarySchema", () => {
	const payload = {
		name: "Uniswap",
		total24h: 1_000_000_000,
		totalAllTime: 500_000_000_000,
		chains: ["Ethereum", "Arbitrum"],
	};

	it("parses a representative full payload", () => {
		const result = DexSummarySchema.parse(payload);
		expect(result.name).toBe("Uniswap");
		expect(result.total24h).toBe(1_000_000_000);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, futureKey: 42 };
		const result = DexSummarySchema.parse(withExtra);
		assertPassthrough(result, "futureKey", 42);
	});
});

// ---------------------------------------------------------------------------
// DexOverviewSchema
// ---------------------------------------------------------------------------

describe("DexOverviewSchema", () => {
	const payload = {
		protocols: [{ name: "Uniswap", displayName: "Uniswap v3", total24h: 1e9 }],
		allChains: ["Ethereum", "BSC"],
	};

	it("parses a representative full payload", () => {
		const result = DexOverviewSchema.parse(payload);
		expect(result.protocols).toHaveLength(1);
		expect(result.allChains).toContain("Ethereum");
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, unknownMetric: "foo" };
		const result = DexOverviewSchema.parse(withExtra);
		assertPassthrough(result, "unknownMetric", "foo");
	});
});

// ---------------------------------------------------------------------------
// FeesSummarySchema
// ---------------------------------------------------------------------------

describe("FeesSummarySchema", () => {
	const payload = {
		id: "uniswap",
		name: "Uniswap",
		chains: ["Ethereum"],
		total24h: 5_000_000,
		total7d: 35_000_000,
		totalAllTime: 2_000_000_000,
		change_1d: -2.5,
	};

	it("parses a representative full payload", () => {
		const result = FeesSummarySchema.parse(payload);
		expect(result.id).toBe("uniswap");
		expect(result.total24h).toBe(5_000_000);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, newApiField: "beta" };
		const result = FeesSummarySchema.parse(withExtra);
		assertPassthrough(result, "newApiField", "beta");
	});
});

// ---------------------------------------------------------------------------
// FeesOverviewSchema
// ---------------------------------------------------------------------------

describe("FeesOverviewSchema", () => {
	const payload = {
		protocols: [{ name: "Uniswap", total24h: 5_000_000, revenue24h: 500_000 }],
	};

	it("parses a representative full payload", () => {
		const result = FeesOverviewSchema.parse(payload);
		expect(result.protocols).toHaveLength(1);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, meta: "extra" };
		const result = FeesOverviewSchema.parse(withExtra);
		assertPassthrough(result, "meta", "extra");
	});
});

// ---------------------------------------------------------------------------
// OptionsSummarySchema
// ---------------------------------------------------------------------------

describe("OptionsSummarySchema", () => {
	const payload = {
		id: "deribit",
		name: "Deribit",
		chains: ["Ethereum"],
		total24h: 200_000_000,
		totalAllTime: 10_000_000_000,
	};

	it("parses a representative full payload", () => {
		const result = OptionsSummarySchema.parse(payload);
		expect(result.name).toBe("Deribit");
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, extraX: 99 };
		const result = OptionsSummarySchema.parse(withExtra);
		assertPassthrough(result, "extraX", 99);
	});
});

// ---------------------------------------------------------------------------
// OptionsOverviewSchema
// ---------------------------------------------------------------------------

describe("OptionsOverviewSchema", () => {
	const payload = {
		protocols: [{ name: "Deribit", totalNotionalVolume: 1e10 }],
		totalDataChart: [{ date: 1_609_459_200, totalVolume: 1e9 }],
	};

	it("parses a representative full payload", () => {
		const result = OptionsOverviewSchema.parse(payload);
		expect(result.protocols).toHaveLength(1);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, beta: true };
		const result = OptionsOverviewSchema.parse(withExtra);
		assertPassthrough(result, "beta", true);
	});
});

// ---------------------------------------------------------------------------
// StablecoinsSchema
// ---------------------------------------------------------------------------

describe("StablecoinsSchema", () => {
	const payload = {
		peggedAssets: [
			{
				id: "1",
				name: "Tether",
				symbol: "USDT",
				pegType: "peggedUSD",
				pegMechanism: "fiat-backed",
				circulating: { peggedUSD: 80_000_000_000 },
				chains: ["Ethereum", "Tron"],
				price: 1.001,
			},
		],
	};

	it("parses a representative full payload", () => {
		const result = StablecoinsSchema.parse(payload);
		expect(result.peggedAssets).toHaveLength(1);
		expect(result.peggedAssets[0].symbol).toBe("USDT");
	});

	it("preserves unknown fields on root and array elements (passthrough)", () => {
		const withExtra = {
			...payload,
			totalMcap: 100_000_000_000,
		};
		const result = StablecoinsSchema.parse(withExtra);
		assertPassthrough(result, "totalMcap", 100_000_000_000);
	});
});

// ---------------------------------------------------------------------------
// StablecoinChainsSchema
// ---------------------------------------------------------------------------

describe("StablecoinChainsSchema", () => {
	const payload = [
		{ name: "Ethereum", totalCirculating: { peggedUSD: 60_000_000_000 } },
		{ name: "Tron", totalCirculating: { peggedUSD: 45_000_000_000 } },
	];

	it("parses a representative full payload", () => {
		const result = StablecoinChainsSchema.parse(payload);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Ethereum");
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [
			{
				name: "Ethereum",
				totalCirculating: { peggedUSD: 1 },
				domainNew: "test",
			},
		];
		const result = StablecoinChainsSchema.parse(withExtra);
		assertPassthrough(result[0], "domainNew", "test");
	});
});

// ---------------------------------------------------------------------------
// StablecoinChartsSchema
// ---------------------------------------------------------------------------

describe("StablecoinChartsSchema", () => {
	const payload = [
		{
			date: 1_609_459_200,
			totalCirculating: { peggedUSD: 25_000_000_000 },
			totalCirculatingUSD: 25_000_000_000,
		},
	];

	it("parses a representative full payload", () => {
		const result = StablecoinChartsSchema.parse(payload);
		expect(result[0].date).toBe(1_609_459_200);
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [
			{
				date: 1_609_459_200,
				totalCirculating: { peggedUSD: 1 },
				_extra: "x",
			},
		];
		const result = StablecoinChartsSchema.parse(withExtra);
		assertPassthrough(result[0], "_extra", "x");
	});
});

// ---------------------------------------------------------------------------
// StablecoinPricesSchema
// ---------------------------------------------------------------------------

describe("StablecoinPricesSchema", () => {
	const payload = [
		{ date: 1_609_459_200, prices: { USDT: 1.001, USDC: 0.999 } },
	];

	it("parses a representative full payload", () => {
		const result = StablecoinPricesSchema.parse(payload);
		expect(result[0].prices.USDT).toBeCloseTo(1.001);
	});

	it("preserves unknown fields on array elements (passthrough)", () => {
		const withExtra = [
			{ date: 1_609_459_200, prices: { USDT: 1 }, extra: "y" },
		];
		const result = StablecoinPricesSchema.parse(withExtra);
		assertPassthrough(result[0], "extra", "y");
	});
});

// ---------------------------------------------------------------------------
// CurrentPricesSchema
// ---------------------------------------------------------------------------

describe("CurrentPricesSchema", () => {
	const payload = {
		coins: {
			"ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
				decimals: 6,
				price: 1.0,
				symbol: "USDC",
				timestamp: 1_700_000_000,
				confidence: 0.99,
			},
		},
	};

	it("parses a representative full payload", () => {
		const result = CurrentPricesSchema.parse(payload);
		const coin =
			result.coins["ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"];
		expect(coin.symbol).toBe("USDC");
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, requestId: "abc-123" };
		const result = CurrentPricesSchema.parse(withExtra);
		assertPassthrough(result, "requestId", "abc-123");
	});
});

// ---------------------------------------------------------------------------
// FirstPricesSchema
// ---------------------------------------------------------------------------

describe("FirstPricesSchema", () => {
	const payload = {
		coins: {
			"coingecko:ethereum": {
				price: 0.43,
				symbol: "ETH",
				timestamp: 1_438_918_400,
			},
		},
	};

	it("parses a representative full payload", () => {
		const result = FirstPricesSchema.parse(payload);
		expect(result.coins["coingecko:ethereum"].symbol).toBe("ETH");
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, source: "historical" };
		const result = FirstPricesSchema.parse(withExtra);
		assertPassthrough(result, "source", "historical");
	});
});

// ---------------------------------------------------------------------------
// BatchHistoricalSchema
// ---------------------------------------------------------------------------

describe("BatchHistoricalSchema", () => {
	const payload = {
		coins: {
			"coingecko:ethereum": {
				symbol: "ETH",
				prices: [
					{ timestamp: 1_700_000_000, price: 2000, confidence: 0.99 },
					{ timestamp: 1_700_086_400, price: 2050, confidence: 0.98 },
				],
			},
		},
	};

	it("parses a representative full payload", () => {
		const result = BatchHistoricalSchema.parse(payload);
		expect(result.coins["coingecko:ethereum"].prices).toHaveLength(2);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, batchId: "b1" };
		const result = BatchHistoricalSchema.parse(withExtra);
		assertPassthrough(result, "batchId", "b1");
	});
});

// ---------------------------------------------------------------------------
// PercentageSchema
// ---------------------------------------------------------------------------

describe("PercentageSchema", () => {
	const payload = {
		coins: {
			"ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": -2.3,
			"coingecko:bitcoin": 5.42,
		},
	};

	it("parses a representative full payload", () => {
		const result = PercentageSchema.parse(payload);
		expect(result.coins["coingecko:bitcoin"]).toBeCloseTo(5.42);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, period: "1d" };
		const result = PercentageSchema.parse(withExtra);
		assertPassthrough(result, "period", "1d");
	});
});

// ---------------------------------------------------------------------------
// PriceChartSchema
// ---------------------------------------------------------------------------

describe("PriceChartSchema", () => {
	const payload = {
		coins: {
			"coingecko:ethereum": {
				decimals: 18,
				confidence: 0.99,
				symbol: "ETH",
				prices: [
					{ timestamp: 1_700_000_000, price: 2000 },
					{ timestamp: 1_700_086_400, price: 2050 },
				],
			},
		},
	};

	it("parses a representative full payload", () => {
		const result = PriceChartSchema.parse(payload);
		expect(result.coins["coingecko:ethereum"].prices).toHaveLength(2);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, span: 30 };
		const result = PriceChartSchema.parse(withExtra);
		assertPassthrough(result, "span", 30);
	});
});

// ---------------------------------------------------------------------------
// PoolsSchema
// ---------------------------------------------------------------------------

describe("PoolsSchema", () => {
	const payload = {
		status: "success",
		data: Array.from({ length: 50 }, (_, i) => ({
			pool: `pool-${i}`,
			chain: "Ethereum",
			project: `project-${i}`,
			symbol: `TOKEN${i}`,
			tvlUsd: i * 1000,
			apy: i * 0.1,
		})),
	};

	it("parses a representative full payload (no slice/sort)", () => {
		const result = PoolsSchema.parse(payload);
		expect(result.data).toHaveLength(50);
		expect(result.status).toBe("success");
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, generatedAt: "2024-01-01" };
		const result = PoolsSchema.parse(withExtra);
		assertPassthrough(result, "generatedAt", "2024-01-01");
	});

	it("preserves unknown fields on data elements (passthrough)", () => {
		const withExtraOnItem = {
			status: "success",
			data: [
				{
					pool: "p1",
					chain: "Ethereum",
					project: "proj",
					symbol: "TKN",
					tvlUsd: 1000,
					apy: 5,
					newField: "from-upstream",
				},
			],
		};
		const result = PoolsSchema.parse(withExtraOnItem);
		assertPassthrough(result.data[0], "newField", "from-upstream");
	});
});

// ---------------------------------------------------------------------------
// HistoricalPoolSchema
// ---------------------------------------------------------------------------

describe("HistoricalPoolSchema", () => {
	const payload = {
		data: [
			{
				timestamp: "2024-01-01T00:00:00.000Z",
				tvlUsd: 1_000_000,
				apy: 5.2,
				apyBase: 3.0,
				apyReward: 2.2,
			},
		],
	};

	it("parses a representative full payload", () => {
		const result = HistoricalPoolSchema.parse(payload);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].apy).toBeCloseTo(5.2);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, poolId: "abc-123" };
		const result = HistoricalPoolSchema.parse(withExtra);
		assertPassthrough(result, "poolId", "abc-123");
	});
});

// ---------------------------------------------------------------------------
// BlockSchema
// ---------------------------------------------------------------------------

describe("BlockSchema", () => {
	const payload = {
		height: 19_000_000,
		timestamp: 1_700_000_000,
	};

	it("parses a representative full payload", () => {
		const result = BlockSchema.parse(payload);
		expect(result.height).toBe(19_000_000);
		expect(result.timestamp).toBe(1_700_000_000);
	});

	it("preserves unknown fields (passthrough)", () => {
		const withExtra = { ...payload, chain: "ethereum" };
		const result = BlockSchema.parse(withExtra);
		assertPassthrough(result, "chain", "ethereum");
	});
});
