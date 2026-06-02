import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOL_METADATA } from "./tool-metadata.js";

describe("tool-metadata in-process checks", () => {
	it("contains exactly 23 entries", () => {
		expect(TOOL_METADATA).toHaveLength(23);
	});

	it("has unique, defillama-prefixed qualified ids", () => {
		const qualified = TOOL_METADATA.map((m) => m.qualified);
		expect(new Set(qualified).size).toBe(qualified.length);
		for (const q of qualified) {
			expect(q.startsWith("defillama.")).toBe(true);
		}
	});

	it("has unique tool names", () => {
		const names = TOOL_METADATA.map((m) => m.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("every entry exposes zod parameter + response schemas and a description/example", () => {
		for (const m of TOOL_METADATA) {
			expect(m.parameters).toBeInstanceOf(z.ZodType);
			expect(m.responseSchema).toBeInstanceOf(z.ZodType);
			expect(m.description.length).toBeGreaterThan(20);
			expect(m.exampleCall.length).toBeGreaterThan(10);
		}
	});

	it("every sandboxImpl resolves to a bound function", async () => {
		for (const m of TOOL_METADATA) {
			const fn = await m.sandboxImpl();
			expect(typeof fn).toBe("function");
			// lazyMethod returns fn.bind(svc); a bound function's name is "bound <name>".
			// This proves the binding step ran (an unbound reference would not match).
			expect(fn.name).toMatch(/^bound /);
		}
	});
});
