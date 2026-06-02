// src/mcp/endpoints/tools.test.ts
//
// Exercises the dynamic-tools triad (list_endpoints, get_endpoint_schema,
// invoke_endpoint) against the real TOOL_METADATA catalog. invoke_endpoint's
// upstream call is intercepted with msw — the chosen endpoint
// (defillama.protocol.getChains) hits https://api.llama.fi/v2/chains.

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	getEndpointSchemaTool,
	invokeEndpointTool,
	listEndpointsTool,
} from "./tools.js";

const CHAINS_URL = "https://api.llama.fi/v2/chains";

const chainsPayload = [
	{ name: "Ethereum", tvl: 100 },
	{ name: "BSC", tvl: 50 },
	{ name: "Polygon", tvl: 30 },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("list_endpoints", () => {
	it("returns every endpoint when no filter is provided", async () => {
		const res = await listEndpointsTool.execute({});
		const inner = JSON.parse(res.content[0]?.text);
		// Catalog has 23 entries.
		expect(inner.endpoints).toHaveLength(23);
		expect(inner.endpoints[0]).toHaveProperty("qualified");
		expect(inner.endpoints[0]).toHaveProperty("description");
	});

	it("narrows results when a filter is provided", async () => {
		const res = await listEndpointsTool.execute({ filter: "fees" });
		const inner = JSON.parse(res.content[0]?.text);
		expect(inner.endpoints.length).toBeGreaterThan(0);
		expect(inner.endpoints.length).toBeLessThan(23);
		for (const e of inner.endpoints) {
			const haystack = `${e.qualified} ${e.description}`.toLowerCase();
			expect(haystack).toContain("fees");
		}
		// The two fees endpoints should be present.
		const qualifieds = inner.endpoints.map(
			(e: { qualified: string }) => e.qualified,
		);
		expect(qualifieds).toContain("defillama.fees.getFeesSummary");
		expect(qualifieds).toContain("defillama.fees.getFeesOverview");
	});
});

describe("get_endpoint_schema", () => {
	it("returns the full schema for a known endpoint", async () => {
		const res = await getEndpointSchemaTool.execute({
			name: "defillama.protocol.getChains",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner.qualified).toBe("defillama.protocol.getChains");
		expect(inner.description).toBeTruthy();
		expect(inner.params).toBeTypeOf("object");
		expect(inner.response).toBeTypeOf("object");
		expect(inner.exampleCall).toContain("defillama.protocol.getChains");
	});

	it("returns an error for an unknown endpoint", async () => {
		const res = await getEndpointSchemaTool.execute({
			name: "defillama.unknown.method",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.error).toContain("Unknown endpoint");
	});
});

describe("invoke_endpoint", () => {
	it("happy path: invokes the raw fn and returns the JSON response", async () => {
		server.use(http.get(CHAINS_URL, () => HttpResponse.json(chainsPayload)));
		const res = await invokeEndpointTool.execute({
			name: "defillama.protocol.getChains",
			params: {},
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner).toEqual(chainsPayload);
	});

	it("applies a jq_filter projection (single-output unwrap)", async () => {
		server.use(http.get(CHAINS_URL, () => HttpResponse.json(chainsPayload)));
		const res = await invokeEndpointTool.execute({
			name: "defillama.protocol.getChains",
			params: {},
			jq_filter: ".[].name",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		// `.[].name` produces multiple outputs → array (no single-output unwrap).
		expect(inner).toEqual(["Ethereum", "BSC", "Polygon"]);
	});

	it("single-output jq_filter unwraps to a scalar", async () => {
		server.use(http.get(CHAINS_URL, () => HttpResponse.json(chainsPayload)));
		const res = await invokeEndpointTool.execute({
			name: "defillama.protocol.getChains",
			params: {},
			jq_filter: ".[0].name",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner).toBe("Ethereum");
	});

	it("rejects params that violate the schema, returning expectedSchema", async () => {
		// getProtocol requires a string `protocol`; pass a number to violate it.
		const res = await invokeEndpointTool.execute({
			name: "defillama.protocol.getProtocol",
			params: { protocol: 123 },
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.error).toContain("Invalid params");
		expect(inner.expectedSchema).toBeDefined();
	});

	it("returns an error for an unknown endpoint", async () => {
		const res = await invokeEndpointTool.execute({
			name: "defillama.unknown.method",
			params: {},
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.error).toContain("Unknown endpoint");
	});
});
