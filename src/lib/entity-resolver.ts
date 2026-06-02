/**
 * Deterministic, catalog-backed entity resolution.
 *
 * Replaces the old Gemini/LLM resolvers with pure lookups over DefiLlama's own
 * live catalogs (cached with a 24h TTL). Each resolver matches case-insensitively
 * against the upstream entity list and falls back gracefully when the live fetch
 * fails: chains fall back to the bundled `enums/chains.ts` catalog; protocols and
 * stablecoins fall back to an empty list so resolution simply returns `null`
 * rather than crashing.
 *
 * `resolveChain` returns BOTH forms of the chain identifier (C2): `name` is the
 * DefiLlama display name (feeds api.llama.fi endpoints) and `slug` is the
 * lowercase coins-API chain slug (feeds coins.llama.fi `chain:address` calls).
 */
import { chains as bundledChains } from "../enums/chains.js";
import { protocolService, stablecoinService } from "../services/index.js";
import type { ProtocolData, StablecoinData } from "../types.js";
import { createChildLogger } from "./utils/index.js";

const logger = createChildLogger("DefiLlama MCP Entity Resolver");

const TTL_MS = 24 * 60 * 60 * 1000;

export type ChainResolved = { name: string; slug: string };

/**
 * Aliases for chain inputs that share zero substring with DefiLlama's chain
 * names and so won't resolve via exact/substring matching. Lowercase keys map
 * to the lowercase chain slug. Keep this table small; grow only when a real
 * user-facing resolution failure surfaces.
 */
const CHAIN_ALIASES: Record<string, string> = {
	binance: "bsc",
	"binance smart chain": "bsc",
	matic: "polygon",
	eth: "ethereum",
	avax: "avalanche",
};

// ============================================================================
// Chain catalog
// ============================================================================

let chainCache: { rows: ChainResolved[]; loadedAt: number } | null = null;

async function getChainCatalog(): Promise<ChainResolved[]> {
	const now = Date.now();
	if (chainCache && now - chainCache.loadedAt < TTL_MS) {
		return chainCache.rows;
	}
	try {
		const live = await protocolService.getChainsRaw();
		const rows = live.map((c) => ({
			name: c.name,
			slug: c.name.toLowerCase(),
		}));
		chainCache = { rows, loadedAt: now };
		return rows;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn(
			`Failed to fetch chain list from DefiLlama, falling back to bundled catalog: ${msg}`,
		);
		return bundledChains.map((c) => ({ name: c.name, slug: c.slug }));
	}
}

/**
 * Resolve a user-facing chain name/alias to `{ name, slug }`. Match order:
 *   1. exact slug or name (case-insensitive)
 *   2. alias table
 *   3. substring match on name (either direction)
 * Returns null when nothing matches.
 */
export async function resolveChain(
	input: string,
): Promise<ChainResolved | null> {
	// Defensive: these resolvers are also invoked from the untyped sandbox bridge
	// (Phase 5) and the defillama_resolve tool, so a non-string can arrive at runtime.
	if (typeof input !== "string") return null;
	const q = input.trim().toLowerCase();
	if (!q) return null;

	const rows = await getChainCatalog();

	const exact = rows.find((r) => r.name.toLowerCase() === q || r.slug === q);
	if (exact) return exact;

	const aliasTarget = CHAIN_ALIASES[q];
	if (aliasTarget) {
		const verified = rows.find((r) => r.slug === aliasTarget);
		if (verified) return verified;
		logger.warn(
			`Alias "${input}" -> "${aliasTarget}" but that slug is not in DefiLlama's current chain list`,
		);
	}

	// Substring match, either direction — both arms length-guarded so the fuzzy
	// fallback can't produce arbitrary matches:
	//  - `name.includes(q)` only fires for queries of >= 3 chars, so a 1-2 char
	//    query ("e", "ar") doesn't match the first chain that happens to contain
	//    it ("Ethereum", "Arbitrum"). Short canonical names resolve via the exact
	//    or alias steps above.
	//  - `q.includes(name)` only fires for chain names of >= 4 chars, so short
	//    names (Base, Sei, TON, Op, BNB) don't false-positive on unrelated inputs
	//    like "base58" -> Base or "tronlink" -> Tron.
	const MIN_QUERY_SUBSTRING_LEN = 3;
	const partial = rows.find((r) => {
		const name = r.name.toLowerCase();
		return (
			(q.length >= MIN_QUERY_SUBSTRING_LEN && name.includes(q)) ||
			(name.length >= 4 && q.includes(name))
		);
	});
	if (partial) return partial;

	logger.warn(`Could not resolve chain: "${input}"`);
	return null;
}

// ============================================================================
// Protocol catalog
// ============================================================================

let protocolCache: { rows: ProtocolData[]; loadedAt: number } | null = null;

async function getProtocolCatalog(): Promise<ProtocolData[]> {
	const now = Date.now();
	if (protocolCache && now - protocolCache.loadedAt < TTL_MS) {
		return protocolCache.rows;
	}
	try {
		const live = await protocolService.getProtocolsRaw();
		protocolCache = { rows: live, loadedAt: now };
		return live;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn(
			`Failed to fetch protocol list from DefiLlama, returning empty catalog: ${msg}`,
		);
		return [];
	}
}

function protocolSlug(p: ProtocolData): string {
	// `p` comes from the untrusted live /protocols payload, so guard every field.
	// Prefer the real slug; else slugify the name; else fall back to the symbol.
	// A matched protocol always has at least one of these as a non-empty string
	// (the matcher only matches on slug/name/symbol === query), so this never
	// returns "" for a real match — and never throws on a missing/non-string field.
	if (typeof p.slug === "string" && p.slug) return p.slug;
	if (typeof p.name === "string" && p.name) {
		return p.name.toLowerCase().replace(/\s+/g, "-");
	}
	if (typeof p.symbol === "string" && p.symbol) return p.symbol.toLowerCase();
	return "";
}

/**
 * Resolve a user-facing protocol name/symbol/slug to a DefiLlama protocol slug.
 * Returns null when nothing matches.
 */
export async function resolveProtocol(input: string): Promise<string | null> {
	if (typeof input !== "string") return null;
	const q = input.trim().toLowerCase();
	if (!q) return null;

	const rows = await getProtocolCatalog();

	const match = rows.find((p) => {
		const slug = typeof p.slug === "string" ? p.slug.toLowerCase() : "";
		const name = typeof p.name === "string" ? p.name.toLowerCase() : "";
		const symbol = typeof p.symbol === "string" ? p.symbol.toLowerCase() : "";
		return slug === q || name === q || symbol === q;
	});
	if (match) return protocolSlug(match);

	logger.warn(`Could not resolve protocol: "${input}"`);
	return null;
}

// ============================================================================
// Stablecoin catalog
// ============================================================================

let stablecoinCache: { rows: StablecoinData[]; loadedAt: number } | null = null;

async function getStablecoinCatalog(): Promise<StablecoinData[]> {
	const now = Date.now();
	if (stablecoinCache && now - stablecoinCache.loadedAt < TTL_MS) {
		return stablecoinCache.rows;
	}
	try {
		const res = await stablecoinService.getStablecoinsRaw({});
		const rows = res.peggedAssets ?? [];
		stablecoinCache = { rows, loadedAt: now };
		return rows;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn(
			`Failed to fetch stablecoin list from DefiLlama, returning empty catalog: ${msg}`,
		);
		return [];
	}
}

/**
 * Resolve a user-facing stablecoin name/symbol to its DefiLlama numeric id
 * (returned as a string). A numeric-string input is returned as-is. Returns
 * null when nothing matches.
 */
export async function resolveStablecoin(input: string): Promise<string | null> {
	if (typeof input !== "string") return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	if (/^\d+$/.test(trimmed)) return trimmed;

	const q = trimmed.toLowerCase();
	const rows = await getStablecoinCatalog();

	const match = rows.find((s) => {
		const name = typeof s.name === "string" ? s.name.toLowerCase() : "";
		const symbol = typeof s.symbol === "string" ? s.symbol.toLowerCase() : "";
		return name === q || symbol === q;
	});
	if (match) return String(match.id);

	logger.warn(`Could not resolve stablecoin: "${input}"`);
	return null;
}
