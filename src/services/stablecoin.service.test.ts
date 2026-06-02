import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { StablecoinService } from "./stablecoin.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new StablecoinService();

describe("StablecoinService *Raw methods", () => {
	it("getStablecoinsRaw returns the full /stablecoins payload unmodified", async () => {
		const payload = {
			peggedAssets: [
				{
					id: "1",
					name: "USDT",
					symbol: "USDT",
					circulating: { peggedUSD: 1 },
				},
				{
					id: "2",
					name: "USDC",
					symbol: "USDC",
					circulating: { peggedUSD: 2 },
				},
			],
			extra: "keep",
		};
		server.use(
			http.get("https://stablecoins.llama.fi/stablecoins", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getStablecoinsRaw({});
		expect(result).toEqual(payload);
		expect(result.peggedAssets).toHaveLength(2);
	});

	it("getStablecoinChainsRaw returns the full /stablecoinchains payload", async () => {
		const payload = [
			{ name: "Ethereum", totalCirculating: { peggedUSD: 10 } },
			{ name: "Tron", totalCirculating: { peggedUSD: 20 } },
		];
		server.use(
			http.get("https://stablecoins.llama.fi/stablecoinchains", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getStablecoinChainsRaw();
		expect(result).toEqual(payload);
	});

	it("getStablecoinChartsRaw defaults to /stablecoincharts/all", async () => {
		const payload = [{ date: 1, totalCirculating: { peggedUSD: 1 } }];
		server.use(
			http.get("https://stablecoins.llama.fi/stablecoincharts/all", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getStablecoinChartsRaw({});
		expect(result).toEqual(payload);
	});

	it("getStablecoinChartsRaw scopes by chain and forwards stablecoin param", async () => {
		const payload = [{ date: 2, totalCirculating: { peggedUSD: 2 } }];
		server.use(
			http.get(
				"https://stablecoins.llama.fi/stablecoincharts/Ethereum",
				({ request }) => {
					const url = new URL(request.url);
					expect(url.searchParams.get("stablecoin")).toBe("1");
					return HttpResponse.json(payload);
				},
			),
		);
		const result = await service.getStablecoinChartsRaw({
			chain: "Ethereum",
			stablecoin: 1,
		});
		expect(result).toEqual(payload);
	});

	it("getStablecoinPricesRaw returns the full /stablecoinprices payload", async () => {
		const payload = [
			{ date: 1, prices: { USDT: 1 } },
			{ date: 2, prices: { USDT: 1.01 } },
		];
		server.use(
			http.get("https://stablecoins.llama.fi/stablecoinprices", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getStablecoinPricesRaw();
		expect(result).toEqual(payload);
	});
});
