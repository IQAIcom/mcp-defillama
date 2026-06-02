import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PriceService } from "./price.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new PriceService();

describe("PriceService *Raw methods", () => {
	it("getCurrentPricesRaw hits /prices/current/{coins} and forwards searchWidth", async () => {
		const payload = { coins: { "ethereum:0xabc": { price: 1, symbol: "X" } } };
		server.use(
			http.get(
				"https://coins.llama.fi/prices/current/:coins",
				({ request }) => {
					const url = new URL(request.url);
					expect(url.searchParams.get("searchWidth")).toBe("4h");
					return HttpResponse.json(payload);
				},
			),
		);
		const result = await service.getCurrentPricesRaw({
			coins: "ethereum:0xabc",
			searchWidth: "4h",
		});
		expect(result).toEqual(payload);
	});

	it("getFirstPricesRaw hits /prices/first/{coins}", async () => {
		const payload = { coins: { "ethereum:0xabc": { price: 1, symbol: "X" } } };
		server.use(
			http.get("https://coins.llama.fi/prices/first/:coins", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getFirstPricesRaw({ coins: "ethereum:0xabc" });
		expect(result).toEqual(payload);
	});

	it("getBatchHistoricalRaw forwards a string coins param", async () => {
		const payload = { coins: {} };
		server.use(
			http.get("https://coins.llama.fi/batchHistorical", ({ request }) => {
				const url = new URL(request.url);
				expect(url.searchParams.get("coins")).toBe("ethereum:0xabc");
				return HttpResponse.json(payload);
			}),
		);
		const result = await service.getBatchHistoricalRaw({
			coins: "ethereum:0xabc",
		});
		expect(result).toEqual(payload);
	});

	it("getBatchHistoricalRaw JSON-encodes an object coins param", async () => {
		const payload = { coins: {} };
		const coinsObj = { "ethereum:0xabc": [1648680149] };
		server.use(
			http.get("https://coins.llama.fi/batchHistorical", ({ request }) => {
				const url = new URL(request.url);
				/*
				 * The service passes raw JSON to URLSearchParams (single-encoded on
				 * the wire); URLSearchParams.get() decodes that one layer, so we get
				 * the plain JSON back — proving there's no double-encoding.
				 */
				expect(url.searchParams.get("coins")).toBe(JSON.stringify(coinsObj));
				return HttpResponse.json(payload);
			}),
		);
		const result = await service.getBatchHistoricalRaw({ coins: coinsObj });
		expect(result).toEqual(payload);
	});

	it("getHistoricalPricesRaw hits /prices/historical/{ts}/{coins}", async () => {
		const payload = { coins: { "ethereum:0xabc": { price: 1, symbol: "X" } } };
		server.use(
			http.get(
				"https://coins.llama.fi/prices/historical/1700000000/:coins",
				() => HttpResponse.json(payload),
			),
		);
		const result = await service.getHistoricalPricesRaw({
			coins: "ethereum:0xabc",
			timestamp: 1700000000,
		});
		expect(result).toEqual(payload);
	});

	it("getPercentageChangeRaw hits /percentage/{coins}", async () => {
		const payload = { coins: { "ethereum:0xabc": -2.3 } };
		server.use(
			http.get("https://coins.llama.fi/percentage/:coins", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getPercentageChangeRaw({
			coins: "ethereum:0xabc",
			period: "1d",
		});
		expect(result).toEqual(payload);
	});

	it("getPriceChartRaw hits /chart/{coins}", async () => {
		const payload = {
			coins: { "ethereum:0xabc": { prices: [], symbol: "X" } },
		};
		server.use(
			http.get("https://coins.llama.fi/chart/:coins", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getPriceChartRaw({ coins: "ethereum:0xabc" });
		expect(result).toEqual(payload);
	});
});
