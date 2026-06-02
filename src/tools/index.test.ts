import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { defillamaTools } from "./index.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("defillamaTools projection (legacy surface)", () => {
	it("defillama_get_chains returns JSON-stringified top-20 projected output sorted by tvl desc", async () => {
		const payload = [
			{ name: "SmallChain", tvl: 5, gecko_id: null, chainId: null },
			{ name: "Ethereum", tvl: 100, gecko_id: "ethereum", chainId: 1 },
			{ name: "BSC", tvl: 50, gecko_id: "binancecoin", chainId: 56 },
		];
		server.use(
			http.get("https://api.llama.fi/v2/chains", () =>
				HttpResponse.json(payload),
			),
		);

		const tool = defillamaTools.find((t) => t.name === "defillama_get_chains");
		if (!tool) throw new Error("chains tool not found");

		const output = await tool.execute({ order: "desc" } as never);
		expect(typeof output).toBe("string");

		const parsed = JSON.parse(output);
		// Projected to { name, tvl } only, sorted desc by tvl.
		expect(parsed).toEqual([
			{ name: "Ethereum", tvl: 100 },
			{ name: "BSC", tvl: 50 },
			{ name: "SmallChain", tvl: 5 },
		]);
	});
});
