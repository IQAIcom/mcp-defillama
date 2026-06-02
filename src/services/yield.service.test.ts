import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { YieldService } from "./yield.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new YieldService();

describe("YieldService *Raw methods", () => {
	it("getLatestPoolsRaw returns the full /pools payload unmodified (no sort/limit)", async () => {
		const payload = {
			status: "success",
			data: [
				{ pool: "a", chain: "Ethereum", project: "x", tvlUsd: 1, apy: 5 },
				{ pool: "b", chain: "Solana", project: "y", tvlUsd: 100, apy: 1 },
				{ pool: "c", chain: "Tron", project: "z", tvlUsd: 50, apy: 9 },
			],
		};
		server.use(
			http.get("https://yields.llama.fi/pools", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getLatestPoolsRaw();
		expect(result).toEqual(payload);
		expect(result.data).toHaveLength(3);
		// Order preserved — not re-sorted by tvlUsd.
		expect(result.data.map((p) => p.pool)).toEqual(["a", "b", "c"]);
	});

	it("getHistoricalPoolDataRaw hits /chart/{pool}", async () => {
		const payload = {
			data: [
				{ timestamp: "t1", tvlUsd: 1, apy: 5, apyBase: 2, apyReward: 3 },
				{ timestamp: "t2", tvlUsd: 2, apy: 6, apyBase: 3, apyReward: 3 },
			],
		};
		server.use(
			http.get("https://yields.llama.fi/chart/some-pool", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getHistoricalPoolDataRaw({
			pool: "some-pool",
		});
		expect(result).toEqual(payload);
	});
});
