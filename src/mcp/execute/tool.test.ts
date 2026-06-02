import { describe, expect, it, vi } from "vitest";

vi.mock("./sandbox.js", () => ({
	runInSandbox: vi.fn(async () => {
		const err = new Error("Cannot find module 'isolated-vm'") as Error & {
			code?: string;
		};
		err.code = "ERR_MODULE_NOT_FOUND";
		throw err;
	}),
}));

describe("executeTool error envelope", () => {
	it("isolated-vm load failure → canonical message in {ok:false}", async () => {
		const { executeTool } = await import("./tool.js");
		const res = await executeTool.execute({ code: "async function run(){}" });
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.ok).toBe(false);
		expect(inner.error).toContain("isolated-vm native module failed to load");
		expect(inner.error).toContain("pnpm rebuild isolated-vm");
	});

	it("BigInt result → ok:false canonical 'not JSON-serializable' envelope", async () => {
		/**
		 * Replace the existing mock with a sandbox stub that returns a BigInt result
		 * — this simulates `async function run(){ return 1n; }` from the guest.
		 */
		vi.resetModules();
		vi.doMock("./sandbox.js", () => ({
			runInSandbox: vi.fn(async () => ({
				ok: true,
				result: 1n,
				log_lines: [],
				err_lines: [],
			})),
		}));
		try {
			const { executeTool } = await import("./tool.js");
			const res = await executeTool.execute({
				code: "async function run(){ return 1n; }",
			});
			expect(res.isError).toBe(true);
			const first = res.content[0];
			expect(first).toBeDefined();
			const inner = JSON.parse((first as { text: string }).text);
			expect(inner.ok).toBe(false);
			expect(inner.error).toContain("Result is not JSON-serializable");
			expect(inner.error.toLowerCase()).toMatch(/bigint/);
			// log/err lines preserved
			expect(Array.isArray(inner.log_lines)).toBe(true);
			expect(Array.isArray(inner.err_lines)).toBe(true);
		} finally {
			vi.doUnmock("./sandbox.js");
			vi.resetModules();
		}
	});
});
