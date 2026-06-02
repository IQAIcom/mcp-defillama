import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DexService } from "./dex.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new DexService();

describe("DexService *Raw methods", () => {
	it("getDexSummaryRaw hits /summary/dexs/{protocol} and returns full payload", async () => {
		const payload = {
			name: "Uniswap",
			total24h: 100,
			totalDataChart: [[1, 2]],
			extra: "keep",
		};
		server.use(
			http.get("https://api.llama.fi/summary/dexs/uniswap", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getDexSummaryRaw({ protocol: "uniswap" });
		expect(result).toEqual(payload);
	});

	it("getDexsOverviewRaw hits global /overview/dexs and returns full protocols list", async () => {
		const payload = {
			protocols: [
				{ name: "A", total24h: 1 },
				{ name: "B", total24h: 2 },
				{ name: "C", total24h: 3 },
			],
			allChains: ["Ethereum"],
		};
		server.use(
			http.get("https://api.llama.fi/overview/dexs", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getDexsOverviewRaw({});
		expect(result).toEqual(payload);
		expect(result.protocols).toHaveLength(3);
	});

	it("getDexsOverviewRaw hits chain-scoped /overview/dexs/{chain}", async () => {
		const payload = { protocols: [{ name: "X" }] };
		server.use(
			http.get("https://api.llama.fi/overview/dexs/Ethereum", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getDexsOverviewRaw({ chain: "Ethereum" });
		expect(result).toEqual(payload);
	});
});
