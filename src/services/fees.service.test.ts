import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FeesService } from "./fees.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new FeesService();

describe("FeesService *Raw methods", () => {
	it("getFeesSummaryRaw hits /summary/fees/{protocol} and returns full payload", async () => {
		const payload = { id: "1", name: "Aave", total24h: 5, extra: "keep" };
		server.use(
			http.get("https://api.llama.fi/summary/fees/aave", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getFeesSummaryRaw({ protocol: "aave" });
		expect(result).toEqual(payload);
	});

	it("getFeesOverviewRaw hits global /overview/fees and returns full payload", async () => {
		const payload = {
			protocols: [
				{ name: "A", total24h: 1 },
				{ name: "B", total24h: 2 },
			],
			totalDataChart: [[1, 2]],
		};
		server.use(
			http.get("https://api.llama.fi/overview/fees", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getFeesOverviewRaw({});
		expect(result).toEqual(payload);
		expect(result.protocols).toHaveLength(2);
	});

	it("getFeesOverviewRaw hits chain-scoped /overview/fees/{chain}", async () => {
		const payload = { protocols: [{ name: "X" }] };
		server.use(
			http.get("https://api.llama.fi/overview/fees/Ethereum", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getFeesOverviewRaw({ chain: "Ethereum" });
		expect(result).toEqual(payload);
	});
});
