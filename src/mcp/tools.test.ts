// src/mcp/tools.test.ts
//
// Exercises defillama_resolve across all three kinds. The underlying resolver
// hits the live catalog endpoints (/v2/chains, /protocols, /stablecoins), so
// all three handlers are registered up front — a single module load then
// resolves every kind without needing module-cache isolation between cases.

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resolveTool } from "./tools.js";

const CHAINS_URL = "https://api.llama.fi/v2/chains";
const PROTOCOLS_URL = "https://api.llama.fi/protocols";
const STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins";

const chainsPayload = [
	{ name: "Ethereum", tvl: 100 },
	{ name: "BSC", tvl: 50 },
	{ name: "Polygon", tvl: 30 },
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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("defillama_resolve", () => {
	it("kind:chain 'BSC' → { resolved: { name, slug } }", async () => {
		const res = await resolveTool.execute({ kind: "chain", query: "BSC" });
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner).toEqual({ resolved: { name: "BSC", slug: "bsc" } });
	});

	it("kind:protocol 'Lido' → { resolved: 'lido' }", async () => {
		const res = await resolveTool.execute({ kind: "protocol", query: "Lido" });
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner).toEqual({ resolved: "lido" });
	});

	it("kind:stablecoin 'USDC' → { resolved: '<id>' }", async () => {
		const res = await resolveTool.execute({
			kind: "stablecoin",
			query: "USDC",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner).toEqual({ resolved: "2" });
	});

	it("a miss returns { resolved: null, error } with isError:false", async () => {
		const res = await resolveTool.execute({
			kind: "chain",
			query: "Totally Made Up Chain",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner.resolved).toBeNull();
		expect(inner.error).toBeTruthy();
	});
});
