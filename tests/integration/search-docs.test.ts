// tests/integration/search-docs.test.ts
//
// Exercises the search_docs tool's execute() directly. The full tool-listing
// smoke (the two-tool default surface plus the dynamic four) lives in
// tests/integration/setup-smoke.test.ts, which spawns the built server.
import { describe, expect, it } from "vitest";
import { searchDocsTool } from "../../src/mcp/search-docs/tool.js";

function names(res: Awaited<ReturnType<typeof searchDocsTool.execute>>) {
	const inner = JSON.parse(res.content[0]?.text ?? "{}") as {
		results: { name?: string; kind?: string; qualified?: string }[];
	};
	return inner.results;
}

describe("search_docs integration", () => {
	it("'top protocols by tvl' surfaces defillama_get_protocols", async () => {
		const res = await searchDocsTool.execute({ query: "top protocols by tvl" });
		const hitNames = names(res)
			.map((r) => r.name)
			.filter(Boolean);
		expect(hitNames).toContain("defillama_get_protocols");
	});

	it("'price history chart' surfaces a price method", async () => {
		const res = await searchDocsTool.execute({ query: "price history chart" });
		const qualifieds = names(res)
			.map((r) => r.qualified)
			.filter(Boolean);
		expect(qualifieds.some((q) => q?.startsWith("defillama.price."))).toBe(
			true,
		);
	});

	it("'yield pool apy' surfaces the yield-screen cookbook recipe", async () => {
		const res = await searchDocsTool.execute({ query: "yield pool apy" });
		const results = names(res);
		expect(results.some((r) => r.kind === "prose")).toBe(true);
	});

	it("verbose mode returns full content", async () => {
		const res = await searchDocsTool.execute({
			query: "stablecoin market cap by chain",
			detail: "verbose",
		});
		expect(names(res).length).toBeGreaterThan(0);
	});
});
