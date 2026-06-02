// src/mcp/execute/client.test.ts

import type * as IVM from "isolated-vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as EntityResolver from "../../lib/entity-resolver.js";

/**
 * Mock the resolvers so the bridge tests don't hit the live DefiLlama catalogs.
 * .js extension matches the runtime import string (NodeNext project).
 */
vi.mock("../../lib/entity-resolver.js", async (importOriginal) => {
	const actual = await importOriginal<typeof EntityResolver>();
	return {
		...actual,
		resolveChain: vi.fn(async (n: string) =>
			n === "BSC" ? { name: "BSC", slug: "bsc" } : null,
		),
		resolveProtocol: vi.fn(async (n: string) => (n === "Lido" ? "lido" : null)),
		resolveStablecoin: vi.fn(async (n: string) => (n === "USDC" ? "2" : null)),
	};
});

describe("execute/client.ts proxy forwarding", () => {
	let isolate: IVM.Isolate | undefined;

	beforeEach(async () => {
		vi.resetModules();
	});

	afterEach(() => {
		try {
			isolate?.dispose();
		} catch {
			/* idempotent */
		}
		isolate = undefined;
		vi.restoreAllMocks();
	});

	it("naming asymmetry: guest defillama.protocol.getProtocol dispatches to protocolService.getProtocolRaw", async () => {
		const servicesMod = await import("../../services/index.js");
		const rawSpy = vi
			.spyOn(
				servicesMod.protocolService as unknown as {
					getProtocolRaw: (...a: unknown[]) => Promise<unknown>;
				},
				"getProtocolRaw",
			)
			.mockResolvedValue({ name: "Lido", tvl: 42 } as never);

		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return await defillama.protocol.getProtocol({protocol:"lido"}); })()`,
		);
		const result = await script.run(ctx, {
			timeout: 5_000,
			promise: true,
			copy: true,
		});

		expect(rawSpy).toHaveBeenCalledTimes(1);
		expect(rawSpy).toHaveBeenCalledWith(
			{ protocol: "lido" },
			expect.objectContaining({
				signal: expect.any(AbortSignal),
				timeout: 6_000,
			}),
		);
		expect(result).toEqual({ name: "Lido", tvl: 42 });
	});

	it("guest cannot see the Raw suffix — defillama.protocol.getProtocolRaw is undefined", async () => {
		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return typeof defillama.protocol.getProtocolRaw; })()`,
		);
		const t = await script.run(ctx, {
			timeout: 5_000,
			promise: true,
			copy: true,
		});
		expect(t).toBe("undefined");
	});

	it("defillama.resolveChain forwards to the mocked resolver and returns {name,slug}", async () => {
		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return await defillama.resolveChain("BSC"); })()`,
		);
		expect(
			await script.run(ctx, { timeout: 5_000, promise: true, copy: true }),
		).toEqual({ name: "BSC", slug: "bsc" });
	});

	it("defillama.resolveProtocol forwards and returns the slug", async () => {
		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return await defillama.resolveProtocol("Lido"); })()`,
		);
		expect(
			await script.run(ctx, { timeout: 5_000, promise: true, copy: true }),
		).toBe("lido");
	});

	it("defillama.resolveStablecoin forwards and returns the id string", async () => {
		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return await defillama.resolveStablecoin("USDC"); })()`,
		);
		expect(
			await script.run(ctx, { timeout: 5_000, promise: true, copy: true }),
		).toBe("2");
	});

	it("zero-arg method: defillama.protocol.getChains() works without passing args", async () => {
		const servicesMod = await import("../../services/index.js");
		const rawSpy = vi
			.spyOn(
				servicesMod.protocolService as unknown as {
					getChainsRaw: (...a: unknown[]) => Promise<unknown>;
				},
				"getChainsRaw",
			)
			.mockResolvedValue([{ name: "Ethereum", tvl: 1 }] as never);

		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => { return await defillama.protocol.getChains(); })()`,
		);
		const result = await script.run(ctx, {
			timeout: 5_000,
			promise: true,
			copy: true,
		});

		expect(rawSpy).toHaveBeenCalledTimes(1);
		// _args is {} for zero-arg, options is the dual-timeout shape
		expect(rawSpy).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				signal: expect.any(AbortSignal),
				timeout: 6_000,
			}),
		);
		expect(result).toEqual([{ name: "Ethereum", tvl: 1 }]);
	});

	it("errors from *Raw propagate through the Callback boundary", async () => {
		const servicesMod = await import("../../services/index.js");
		vi.spyOn(
			servicesMod.protocolService as unknown as {
				getProtocolRaw: (...a: unknown[]) => Promise<unknown>;
			},
			"getProtocolRaw",
		).mockRejectedValue(new Error("upstream 503") as never);

		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => {
				try { await defillama.protocol.getProtocol({protocol:"lido"}); return "no-error"; }
				catch (e) { return e.message; }
			})()`,
		);
		const msg = await script.run(ctx, {
			timeout: 5_000,
			promise: true,
			copy: true,
		});
		expect(msg).toBe("upstream 503");
	});

	it("axios ECONNABORTED through *Raw → client surfaces canonical 5s timeout message", async () => {
		/**
		 * Simulate the failure mode the bot was concerned about: axios throws an
		 * AxiosError with code "ECONNABORTED", extractErrorMessage wraps it and
		 * preserves the code, the service *Raw() catch returns it unchanged, and
		 * client.ts's catch should detect e.code === "ECONNABORTED" and surface
		 * the canonical "DefiLlama call timed out after 5s" message.
		 */
		const servicesMod = await import("../../services/index.js");
		const fakeWrappedError = Object.assign(
			new Error("timeout of 6000ms exceeded"),
			{
				code: "ECONNABORTED",
			},
		);
		vi.spyOn(
			servicesMod.protocolService as unknown as {
				getProtocolRaw: (...a: unknown[]) => Promise<unknown>;
			},
			"getProtocolRaw",
		).mockRejectedValue(fakeWrappedError as never);

		const mod = await import("isolated-vm");
		const ivm = (mod as unknown as { default?: typeof IVM }).default ?? mod;
		isolate = new ivm.Isolate({ memoryLimit: 64 });
		const ctx = await isolate.createContext();
		await ctx.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		const { installDefillamaClient } = await import("./client.js");
		const { createExecutionScope } = await import("./scope.js");
		await installDefillamaClient(ctx, createExecutionScope());

		const script = await isolate.compileScript(
			`(async () => {
				try { await defillama.protocol.getProtocol({protocol:"lido"}); return "no-error"; }
				catch (e) { return e.message; }
			})()`,
		);
		const msg = await script.run(ctx, {
			timeout: 5_000,
			promise: true,
			copy: true,
		});
		expect(msg).toBe(
			"DefiLlama call timed out after 5s: defillama.protocol.getProtocol",
		);
	});
});
