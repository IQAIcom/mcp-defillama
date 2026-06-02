import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { OptionsService } from "./options.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new OptionsService();

describe("OptionsService *Raw methods", () => {
	it("getOptionsSummaryRaw hits /summary/options/{protocol} and returns full payload", async () => {
		const payload = { id: "1", name: "Lyra", total24h: 5, extra: "keep" };
		server.use(
			http.get("https://api.llama.fi/summary/options/lyra", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getOptionsSummaryRaw({ protocol: "lyra" });
		expect(result).toEqual(payload);
	});

	it("getOptionsOverviewRaw hits global /overview/options and returns full payload", async () => {
		const payload = {
			protocols: [
				{ name: "A", total24h: 1 },
				{ name: "B", total24h: 2 },
				{ name: "C", total24h: 3 },
			],
		};
		server.use(
			http.get("https://api.llama.fi/overview/options", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getOptionsOverviewRaw({});
		expect(result).toEqual(payload);
		expect(result.protocols).toHaveLength(3);
	});

	it("getOptionsOverviewRaw hits chain-scoped /overview/options/{chain}", async () => {
		const payload = { protocols: [{ name: "X" }] };
		server.use(
			http.get("https://api.llama.fi/overview/options/Arbitrum", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getOptionsOverviewRaw({ chain: "Arbitrum" });
		expect(result).toEqual(payload);
	});
});
