import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ProtocolService } from "./protocol.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new ProtocolService();

describe("ProtocolService *Raw methods", () => {
	it("getChainsRaw returns the full /v2/chains payload unmodified", async () => {
		const payload = [
			{ name: "Ethereum", tvl: 100, gecko_id: "ethereum", extra: "keep" },
			{ name: "Solana", tvl: 50 },
			{ name: "Tron", tvl: 200 },
		];
		server.use(
			http.get("https://api.llama.fi/v2/chains", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getChainsRaw();
		expect(result).toEqual(payload);
		expect(result).toHaveLength(3);
	});

	it("getProtocolsRaw returns the full /protocols payload unmodified", async () => {
		const payload = [
			{ name: "Aave", symbol: "AAVE", tvl: 10, change_1d: 5, unknown: 1 },
			{ name: "Uniswap", symbol: "UNI", tvl: 20 },
		];
		server.use(
			http.get("https://api.llama.fi/protocols", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getProtocolsRaw();
		expect(result).toEqual(payload);
	});

	it("getProtocolRaw fetches a single protocol with all fields", async () => {
		const payload = {
			id: "1",
			name: "Aave",
			symbol: "AAVE",
			tvl: 10,
			raw: true,
		};
		server.use(
			http.get("https://api.llama.fi/protocol/aave", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getProtocolRaw({ protocol: "aave" });
		expect(result).toEqual(payload);
	});

	it("getHistoricalChainTvlRaw hits the all-chains URL by default", async () => {
		const payload = [
			{ date: 1, tvl: 1 },
			{ date: 2, tvl: 2 },
		];
		server.use(
			http.get("https://api.llama.fi/v2/historicalChainTvl", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getHistoricalChainTvlRaw({});
		expect(result).toEqual(payload);
	});

	it("getHistoricalChainTvlRaw hits the chain-scoped URL when chain provided", async () => {
		const payload = [{ date: 1, tvl: 99 }];
		server.use(
			http.get("https://api.llama.fi/v2/historicalChainTvl/Ethereum", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getHistoricalChainTvlRaw({
			chain: "Ethereum",
		});
		expect(result).toEqual(payload);
	});
});
