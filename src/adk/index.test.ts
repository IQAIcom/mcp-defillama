import { describe, expect, it } from "vitest";
import { getDefillamaTools } from "./index.js";

describe("getDefillamaTools", () => {
	it("returns the two default tools (execute, search_docs)", () => {
		const tools = getDefillamaTools();
		expect(tools.map((t) => t.name).sort()).toEqual(["execute", "search_docs"]);
	});

	it("returns six tools with { dynamic: true }", () => {
		const tools = getDefillamaTools({ dynamic: true });
		expect(tools.map((t) => t.name).sort()).toEqual(
			[
				"defillama_resolve",
				"execute",
				"get_endpoint_schema",
				"invoke_endpoint",
				"list_endpoints",
				"search_docs",
			].sort(),
		);
	});

	it("wraps search_docs so the ADK fn returns the text payload (a string)", async () => {
		const tool = getDefillamaTools().find((t) => t.name === "search_docs");
		expect(tool).toBeDefined();
		// search_docs reads the embedded index — no network needed.
		const out = await (
			tool as unknown as {
				runAsync: (args: Record<string, unknown>, ctx: unknown) => unknown;
			}
		).runAsync({ query: "top protocols by tvl" }, {});
		expect(typeof out).toBe("string");
		// It's the unwrapped text payload, not the raw MCP { content, isError } object.
		const parsed = JSON.parse(out as string) as { results: unknown[] };
		expect(Array.isArray(parsed.results)).toBe(true);
	});
});
