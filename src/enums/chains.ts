/**
 * Bundled DefiLlama chain fallback catalog.
 *
 * Used ONLY when the live `/v2/chains` fetch fails inside the entity resolver,
 * so resolution always has something to work with. This is a curated list of
 * the major chains DefiLlama tracks — NOT the full catalog. `name` is the
 * DefiLlama display name (feeds api.llama.fi endpoints); `slug` is the
 * lowercase coins-API chain slug (feeds coins.llama.fi `chain:address` calls).
 *
 * Caveat: a few slugs contain spaces (e.g. "zksync era") because the live path
 * derives slugs as `name.toLowerCase()`. Callers embedding a slug in a URL must
 * URL-encode it; agents should prefer the resolver's returned `slug` and encode
 * when constructing `chain:address` strings.
 *
 * Grow this list only when a real offline-resolution failure surfaces.
 */
export const chains: { name: string; slug: string; geckoId?: string }[] = [
	{ name: "Ethereum", slug: "ethereum", geckoId: "ethereum" },
	{ name: "BSC", slug: "bsc", geckoId: "binancecoin" },
	{ name: "Arbitrum", slug: "arbitrum", geckoId: "arbitrum" },
	{ name: "Polygon", slug: "polygon", geckoId: "matic-network" },
	{ name: "Optimism", slug: "optimism", geckoId: "optimism" },
	{ name: "Base", slug: "base" },
	{ name: "Avalanche", slug: "avalanche", geckoId: "avalanche-2" },
	{ name: "Solana", slug: "solana", geckoId: "solana" },
	{ name: "Tron", slug: "tron", geckoId: "tron" },
	{ name: "Fantom", slug: "fantom", geckoId: "fantom" },
	{ name: "Gnosis", slug: "gnosis", geckoId: "gnosis" },
	{ name: "Cronos", slug: "cronos", geckoId: "crypto-com-chain" },
	{ name: "Celo", slug: "celo", geckoId: "celo" },
	{ name: "Aurora", slug: "aurora", geckoId: "aurora-near" },
	{ name: "Moonbeam", slug: "moonbeam", geckoId: "moonbeam" },
	{ name: "Moonriver", slug: "moonriver", geckoId: "moonriver" },
	{ name: "Metis", slug: "metis", geckoId: "metis-token" },
	{ name: "Kava", slug: "kava", geckoId: "kava" },
	{ name: "Mantle", slug: "mantle", geckoId: "mantle" },
	{ name: "Scroll", slug: "scroll" },
	{ name: "Linea", slug: "linea" },
	{ name: "zkSync Era", slug: "zksync era" },
	{ name: "Polygon zkEVM", slug: "polygon zkevm" },
	{ name: "Blast", slug: "blast" },
	{ name: "Sui", slug: "sui", geckoId: "sui" },
	{ name: "Aptos", slug: "aptos", geckoId: "aptos" },
	{ name: "Near", slug: "near", geckoId: "near" },
	{ name: "Tezos", slug: "tezos", geckoId: "tezos" },
	{ name: "Bitcoin", slug: "bitcoin", geckoId: "bitcoin" },
	{ name: "Cardano", slug: "cardano", geckoId: "cardano" },
	{ name: "Cosmos", slug: "cosmos", geckoId: "cosmos" },
	{ name: "Osmosis", slug: "osmosis", geckoId: "osmosis" },
	{ name: "Sei", slug: "sei", geckoId: "sei-network" },
	{ name: "Injective", slug: "injective", geckoId: "injective-protocol" },
	{ name: "TON", slug: "ton", geckoId: "the-open-network" },
	{ name: "Starknet", slug: "starknet", geckoId: "starknet" },
];
