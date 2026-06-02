// tests/integration/execute.test.ts

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { executeTool } from "../../src/mcp/execute/tool.js";

const server = setupServer(
	http.get("https://api.llama.fi/v2/chains", () =>
		HttpResponse.json([
			{ name: "Ethereum", tvl: 1_000 },
			{ name: "Arbitrum", tvl: 500 },
		]),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("execute integration", () => {
	it("happy path: real sandbox call to defillama.protocol.getChains, projected return crosses the boundary", async () => {
		const res = await executeTool.execute({
			code: `async function run(d) {
				const chains = await d.protocol.getChains();
				return chains[0].name;
			}`,
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(false);
		expect(inner.ok).toBe(true);
		expect(inner.result).toBe("Ethereum");
	});

	it("rejects TypeScript syntax with a helpful message", async () => {
		const res = await executeTool.execute({
			code: `async function run(d: any) { return null; }`,
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.ok).toBe(false);
		expect(inner.error.toLowerCase()).toMatch(/unexpected|syntax/);
	});

	it("intentional throw → ok:false", async () => {
		const res = await executeTool.execute({
			code: `async function run(){ throw new Error("boom"); }`,
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.ok).toBe(false);
		expect(inner.error).toBe("boom");
	});

	it("never-settling promise → outer race fires with canonical message", async () => {
		const prev = process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS;
		process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS = "1000";
		vi.resetModules();
		try {
			const { executeTool: fast } = await import(
				"../../src/mcp/execute/tool.js"
			);
			const res = await fast.execute({
				code: `async function run(){ await new Promise(() => {}); }`,
			});
			const inner = JSON.parse(res.content[0]?.text);
			expect(res.isError).toBe(true);
			expect(inner.error).toContain("Execute timed out after");
			expect(inner.error.toLowerCase()).toMatch(
				/no call to settle|non-yielding/,
			);
		} finally {
			if (prev === undefined)
				delete process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS;
			else process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS = prev;
			vi.resetModules();
		}
	}, 5_000);

	it("DefiLlama request that hangs >5s → canonical per-call timeout error", async () => {
		server.use(
			http.get("https://api.llama.fi/protocol/uniswap", async () => {
				await new Promise((r) => setTimeout(r, 7_000));
				return HttpResponse.json({ name: "Uniswap" });
			}),
		);
		const res = await executeTool.execute({
			code: `async function run(d) { return await d.protocol.getProtocol({ protocol: "uniswap" }); }`,
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(res.isError).toBe(true);
		expect(inner.error).toContain("DefiLlama call timed out after 5s");
	}, 15_000);

	it("guest schema is enforced — non-string protocol rejects before reaching rawFn", async () => {
		const servicesMod = await import("../../src/services/index.js");
		const rawSpy = vi
			.spyOn(
				servicesMod.protocolService as unknown as {
					getProtocolRaw: (...a: unknown[]) => Promise<unknown>;
				},
				"getProtocolRaw",
			)
			.mockResolvedValue({} as never);
		try {
			const res = await executeTool.execute({
				code: `async function run(d) {
					try { return await d.protocol.getProtocol({ protocol: 12345 }); }
					catch (e) { return "err:" + e.message; }
				}`,
			});
			const inner = JSON.parse(res.content[0]?.text);
			expect(inner.ok).toBe(true);
			expect(typeof inner.result).toBe("string");
			expect(inner.result).toContain("Invalid arguments for");
			expect(inner.result).toContain("defillama.protocol.getProtocol");
			expect(rawSpy).not.toHaveBeenCalled();
		} finally {
			rawSpy.mockRestore();
		}
	});

	it("execute call budget caps fan-out to N upstream calls per invocation", async () => {
		const prev = process.env.DEFILLAMA_MCP_EXECUTE_BUDGET;
		process.env.DEFILLAMA_MCP_EXECUTE_BUDGET = "3";
		const servicesMod = await import("../../src/services/index.js");
		const rawSpy = vi
			.spyOn(
				servicesMod.protocolService as unknown as {
					getChainsRaw: (...a: unknown[]) => Promise<unknown>;
				},
				"getChainsRaw",
			)
			.mockResolvedValue([{ name: "Ethereum", tvl: 1 }] as never);
		try {
			const res = await executeTool.execute({
				code: `async function run(d) {
					const results = [];
					for (let i = 0; i < 6; i++) {
						try { results.push(await d.protocol.getChains()); }
						catch (e) { results.push("err:" + e.message); }
					}
					return results;
				}`,
			});
			const inner = JSON.parse(res.content[0]?.text);
			expect(inner.ok).toBe(true);
			expect(rawSpy).toHaveBeenCalledTimes(3);
			expect(inner.result.slice(0, 3)).toEqual([
				[{ name: "Ethereum", tvl: 1 }],
				[{ name: "Ethereum", tvl: 1 }],
				[{ name: "Ethereum", tvl: 1 }],
			]);
			for (const tail of inner.result.slice(3)) {
				expect(tail).toContain("Execute call budget exceeded (3 calls");
			}
		} finally {
			if (prev === undefined) delete process.env.DEFILLAMA_MCP_EXECUTE_BUDGET;
			else process.env.DEFILLAMA_MCP_EXECUTE_BUDGET = prev;
			rawSpy.mockRestore();
		}
	});

	it("execute with defillama.resolveChain inside (mocked resolver) returns {name,slug}", async () => {
		vi.resetModules();
		vi.doMock("../../src/lib/entity-resolver.js", async (importOriginal) => {
			const actual =
				await importOriginal<
					typeof import("../../src/lib/entity-resolver.js")
				>();
			return {
				...actual,
				resolveChain: vi.fn(async (n: string) =>
					n === "Polygon" ? { name: "Polygon", slug: "polygon" } : null,
				),
			};
		});

		try {
			const { executeTool: executeFresh } = await import(
				"../../src/mcp/execute/tool.js"
			);
			const res = await executeFresh.execute({
				code: `async function run(d) { const c = await d.resolveChain("Polygon"); return c.slug; }`,
			});
			const inner = JSON.parse(res.content[0]?.text);
			expect(inner.ok).toBe(true);
			expect(inner.result).toBe("polygon");
		} finally {
			vi.doUnmock("../../src/lib/entity-resolver.js");
			vi.resetModules();
		}
	});
});
