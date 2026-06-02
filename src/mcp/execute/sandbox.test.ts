import { describe, expect, it, vi } from "vitest";
import { runInSandbox } from "./sandbox.js";

describe("runInSandbox blocklist", () => {
	it("rejects code containing 'process.'", async () => {
		const r = await runInSandbox(
			"async function run(){ return process.env; }",
			async () => {},
		);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Blocked identifier: 'process.'");
	});

	it("rejects code containing 'require('", async () => {
		const r = await runInSandbox(
			"async function run(){ return require('fs'); }",
			async () => {},
		);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Blocked identifier: 'require('");
	});

	it("rejects code containing 'import('", async () => {
		const r = await runInSandbox(
			"async function run(){ await import('fs'); }",
			async () => {},
		);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Blocked identifier: 'import('");
	});

	it("rejects code containing 'eval('", async () => {
		const r = await runInSandbox(
			"async function run(){ return eval('1+1'); }",
			async () => {},
		);
		expect(r.ok).toBe(false);
		expect(r.error).toContain("Blocked identifier: 'eval('");
	});
});

describe("runInSandbox guest globals", () => {
	it("sleep(ms) is available and resolves", async () => {
		const start = Date.now();
		const r = await runInSandbox(
			`async function run(){ await sleep(20); return "slept"; }`,
			async () => {},
		);
		const elapsed = Date.now() - start;
		expect(r.ok).toBe(true);
		expect(r.result).toBe("slept");
		expect(elapsed).toBeGreaterThanOrEqual(15);
	});

	it("sleep(ms) is clamped — sleep(99999999) does not exceed the outer deadline", async () => {
		const prev = process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS;
		process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS = "1000";
		vi.resetModules();
		try {
			const { runInSandbox: rs } = await import("./sandbox.js");
			const start = Date.now();
			const r = await rs(
				`async function run(){ await sleep(99999999); await new Promise(() => {}); return "never"; }`,
				async () => {},
			);
			const elapsed = Date.now() - start;
			expect(r.ok).toBe(false);
			expect(r.error).toContain("Execute timed out");
			expect(elapsed).toBeLessThan(2_000);
		} finally {
			if (prev === undefined)
				delete process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS;
			else process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS = prev;
			vi.resetModules();
		}
	}, 5_000);

	it("console.log captures multi-arg calls joined with spaces", async () => {
		const r = await runInSandbox(
			`async function run(){ console.log("hello", "world", 42); return null; }`,
			async () => {},
		);
		expect(r.ok).toBe(true);
		expect(r.log_lines).toEqual(["hello world 42"]);
	});

	it("console.error captures separately from console.log", async () => {
		const r = await runInSandbox(
			`async function run(){ console.log("a"); console.error("b"); return null; }`,
			async () => {},
		);
		expect(r.ok).toBe(true);
		expect(r.log_lines).toEqual(["a"]);
		expect(r.err_lines).toEqual(["b"]);
	});

	it("console.log with a circular object does not crash the execute call", async () => {
		const r = await runInSandbox(
			`async function run(){
				const o = { a: 1 };
				o.self = o;
				console.log(o);
				return "ok";
			}`,
			async () => {},
		);
		expect(r.ok).toBe(true);
		expect(r.result).toBe("ok");
		// The fallback path emits String(x) for cyclic objects → "[object Object]"
		expect(r.log_lines).toEqual(["[object Object]"]);
	});
});
