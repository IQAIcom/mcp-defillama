// src/mcp/search-docs/tool.test.ts
import { describe, expect, it } from "vitest";
import { searchDocsTool } from "./tool.js";

type Hit = {
	kind?: string;
	qualified?: string;
	name?: string;
	content?: string;
};

function parse(res: Awaited<ReturnType<typeof searchDocsTool.execute>>) {
	return JSON.parse(res.content[0]?.text ?? "{}") as {
		results: Hit[];
		hint?: string;
	};
}

describe("search_docs tool", () => {
	it("surfaces a method hit for a method-oriented query", async () => {
		const res = await searchDocsTool.execute({
			query: "top protocols by tvl",
		});
		const { results } = parse(res);
		const methodHit = results.find((r) => r.kind === "method");
		expect(methodHit).toBeDefined();
		expect(methodHit?.qualified).toMatch(/^defillama\.protocol\./);
	});

	it("surfaces a prose cookbook hit with inline content (default detail)", async () => {
		const res = await searchDocsTool.execute({
			query: "yield pool apy screen",
		});
		const { results } = parse(res);
		const proseHit = results.find((r) => r.kind === "prose");
		expect(proseHit).toBeDefined();
		// In default detail, prose entries inline their recipe content so the
		// agent doesn't have to re-query with detail:"verbose".
		expect(typeof proseHit?.content).toBe("string");
		expect(proseHit?.content).toContain("defillama.yield");
	});

	it("returns the empty-results hint for an empty query", async () => {
		const res = await searchDocsTool.execute({ query: "   " });
		const { results, hint } = parse(res);
		expect(results).toHaveLength(0);
		expect(hint).toBeTruthy();
	});

	it("verbose detail returns the fuller stored shape", async () => {
		const res = await searchDocsTool.execute({
			query: "price history chart",
			detail: "verbose",
		});
		const { results } = parse(res);
		expect(results.length).toBeGreaterThan(0);
		// verbose spreads the full stored record incl. the MiniSearch id/score.
		const first = results[0] as Hit & { id?: string; score?: number };
		expect(first.id).toBeDefined();
		expect(typeof first.score).toBe("number");
	});
});
