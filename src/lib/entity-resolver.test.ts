import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const CHAINS_URL = "https://api.llama.fi/v2/chains";
const PROTOCOLS_URL = "https://api.llama.fi/protocols";
const STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins";

const chainsPayload = [
	{ name: "Ethereum", tvl: 100, gecko_id: "ethereum" },
	{ name: "BSC", tvl: 50, gecko_id: "binancecoin" },
	{ name: "Polygon", tvl: 30, gecko_id: "matic-network" },
	{ name: "Solana", tvl: 20, gecko_id: "solana" },
];

const protocolsPayload = [
	{ id: "1", name: "Lido", slug: "lido", symbol: "LDO", tvl: 100 },
	{ id: "2", name: "Aave", slug: "aave-v3", symbol: "AAVE", tvl: 50 },
];

const stablecoinsPayload = {
	peggedAssets: [
		{ id: "1", name: "Tether", symbol: "USDT" },
		{ id: "2", name: "USD Coin", symbol: "USDC" },
	],
};

const server = setupServer(
	http.get(CHAINS_URL, () => HttpResponse.json(chainsPayload)),
	http.get(PROTOCOLS_URL, () => HttpResponse.json(protocolsPayload)),
	http.get(STABLECOINS_URL, () => HttpResponse.json(stablecoinsPayload)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.resetModules();
});
afterAll(() => server.close());

/**
 * The resolver caches each catalog at module scope, so every test that depends
 * on a fresh catalog state re-imports the module after `vi.resetModules()`
 * (run in afterEach). This keeps the network-failure fallback case deterministic
 * regardless of test order.
 */
async function loadResolver() {
	return import("./entity-resolver.js");
}

describe("resolveChain", () => {
	it("resolves an exact name (case-insensitive) to {name, slug}", async () => {
		const { resolveChain } = await loadResolver();
		expect(await resolveChain("Ethereum")).toEqual({
			name: "Ethereum",
			slug: "ethereum",
		});
		expect(await resolveChain("ethereum")).toEqual({
			name: "Ethereum",
			slug: "ethereum",
		});
	});

	it("resolves an exact slug match", async () => {
		const { resolveChain } = await loadResolver();
		expect(await resolveChain("bsc")).toEqual({ name: "BSC", slug: "bsc" });
	});

	it("resolves an alias (Binance -> bsc)", async () => {
		const { resolveChain } = await loadResolver();
		expect(await resolveChain("Binance")).toEqual({
			name: "BSC",
			slug: "bsc",
		});
		expect(await resolveChain("matic")).toEqual({
			name: "Polygon",
			slug: "polygon",
		});
	});

	it("returns null for an unknown chain", async () => {
		const { resolveChain } = await loadResolver();
		expect(await resolveChain("Totally Unknown")).toBeNull();
	});

	it("falls back to the bundled catalog on network failure", async () => {
		server.use(http.get(CHAINS_URL, () => HttpResponse.error()));
		const { resolveChain } = await loadResolver();
		// Bundled catalog includes Ethereum -> ethereum.
		expect(await resolveChain("Ethereum")).toEqual({
			name: "Ethereum",
			slug: "ethereum",
		});
	});

	it("does not let a short chain name false-positive on a longer input", async () => {
		/*
		 * A 3-char name ("TON") must NOT match via the q.includes(name) substring
		 * arm (guarded by name.length >= 4), so "proton" stays unresolved.
		 */
		server.use(
			http.get(CHAINS_URL, () =>
				HttpResponse.json([
					{ name: "TON", tvl: 1, gecko_id: "the-open-network" },
				]),
			),
		);
		const { resolveChain } = await loadResolver();
		expect(await resolveChain("proton")).toBeNull();
		expect(await resolveChain("TON")).toEqual({ name: "TON", slug: "ton" });
	});

	it("does not fuzzy-match 1-2 char queries via substring", async () => {
		const { resolveChain } = await loadResolver();
		/*
		 * "e" would otherwise substring-match "Ethereum"; "so" would match "Solana".
		 * Short queries must resolve via exact/alias only, not the fuzzy fallback.
		 */
		expect(await resolveChain("e")).toBeNull();
		expect(await resolveChain("so")).toBeNull();
		// A >= 3 char substring still resolves through the fuzzy fallback.
		expect(await resolveChain("pol")).toEqual({
			name: "Polygon",
			slug: "polygon",
		});
	});
});

describe("resolveProtocol", () => {
	it("resolves a protocol name to its slug", async () => {
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("Lido")).toBe("lido");
	});

	it("resolves by symbol and existing slug", async () => {
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("AAVE")).toBe("aave-v3");
		expect(await resolveProtocol("aave-v3")).toBe("aave-v3");
	});

	it("slugifies the name when the protocol has no slug field", async () => {
		server.use(
			http.get(PROTOCOLS_URL, () =>
				HttpResponse.json([
					{ id: "3", name: "My Protocol", symbol: "MYP", tvl: 1 },
				]),
			),
		);
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("My Protocol")).toBe("my-protocol");
	});

	it("returns null for an unknown protocol", async () => {
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("Nonexistent Protocol")).toBeNull();
	});

	it("returns null on network failure (no bundled protocol fallback)", async () => {
		server.use(http.get(PROTOCOLS_URL, () => HttpResponse.error()));
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("Lido")).toBeNull();
	});

	it("resolves via symbol without throwing when name/slug are missing", async () => {
		/*
		 * Untrusted live payload: an entry with only a symbol (no slug, no name).
		 * protocolSlug must fall back to the symbol rather than crash on
		 * undefined.toLowerCase().
		 */
		server.use(
			http.get(PROTOCOLS_URL, () =>
				HttpResponse.json([{ id: "9", symbol: "FOO", tvl: 1 }]),
			),
		);
		const { resolveProtocol } = await loadResolver();
		expect(await resolveProtocol("FOO")).toBe("foo");
	});
});

describe("resolveStablecoin", () => {
	it("resolves a symbol to its numeric id string", async () => {
		const { resolveStablecoin } = await loadResolver();
		expect(await resolveStablecoin("USDC")).toBe("2");
	});

	it("resolves by name", async () => {
		const { resolveStablecoin } = await loadResolver();
		expect(await resolveStablecoin("USD Coin")).toBe("2");
	});

	it("returns a numeric input as-is", async () => {
		const { resolveStablecoin } = await loadResolver();
		expect(await resolveStablecoin("2")).toBe("2");
	});

	it("returns null for an unknown stablecoin", async () => {
		const { resolveStablecoin } = await loadResolver();
		expect(await resolveStablecoin("Imaginary Coin")).toBeNull();
	});

	it("returns null on network failure (no bundled stablecoin fallback)", async () => {
		server.use(http.get(STABLECOINS_URL, () => HttpResponse.error()));
		const { resolveStablecoin } = await loadResolver();
		expect(await resolveStablecoin("USDC")).toBeNull();
	});
});
