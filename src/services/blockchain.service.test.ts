import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockchainService } from "./blockchain.service.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const service = new BlockchainService();

describe("BlockchainService *Raw methods", () => {
	it("getBlockAtTimestampRaw hits /block/{chain}/{timestamp} and returns full payload", async () => {
		const payload = { height: 12345, timestamp: 1700000000, extra: "keep" };
		server.use(
			http.get("https://coins.llama.fi/block/ethereum/1700000000", () =>
				HttpResponse.json(payload),
			),
		);
		const result = await service.getBlockAtTimestampRaw({
			chain: "ethereum",
			timestamp: 1700000000,
		});
		expect(result).toEqual(payload);
	});
});
