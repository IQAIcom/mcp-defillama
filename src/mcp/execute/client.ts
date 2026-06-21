// src/mcp/execute/client.ts
//
// Two bridges: installServiceCall (dual-timeout, JSON args, scope-bounded)
// for *Raw() methods; installResolver (spread args) for in-memory helpers.
// Service calls consume from a per-execute ExecutionScope so a single guest
// script can't fan-out unbounded upstream requests.

import dedent from "dedent";
import type * as IVM from "isolated-vm";
import type { z } from "zod";
import {
	resolveChain,
	resolveProtocol,
	resolveStablecoin,
} from "../../lib/entity-resolver.js";
import { TOOL_METADATA } from "../catalog/tool-metadata.js";
import {
	acquireSlot,
	type ExecutionScope,
	releaseSlot,
	tryReserveBudget,
} from "./scope.js";

const ABORT_MS = 5_000;
/**
 * Axios timeout is always `AXIOS_BUFFER_MS` longer than the wrapper abort so
 * the wrapper fires first (giving us a clean canonical "DefiLlama call timed
 * out after Ns" message) while axios remains the safety net. When a method
 * overrides `timeoutMs`, the axios timeout must scale with it — otherwise
 * the axios call rejects at the default 6 s while the wrapper still has
 * budget, rendering the override a no-op for direct (non-aggregate) methods.
 */
const AXIOS_BUFFER_MS = 1_000;

type Envelope = { ok: true; data: unknown } | { ok: false; error: string };

/** Wraps a success value into an ExternalCopy envelope crossing the isolate boundary. */
function envelopeOk(ivm: typeof IVM, data: unknown): unknown {
	return new ivm.ExternalCopy({ ok: true, data } satisfies Envelope).copyInto({
		release: true,
	});
}

/** Wraps an error string into an ExternalCopy envelope crossing the isolate boundary. */
function envelopeFail(ivm: typeof IVM, error: string): unknown {
	return new ivm.ExternalCopy({ ok: false, error } satisfies Envelope).copyInto(
		{ release: true },
	);
}

function parseQualified(qualified: string): [string, string] {
	const parts = qualified.split(".");
	if (parts.length !== 3 || parts[0] !== "defillama")
		throw new Error(`Invalid qualified: ${qualified}`);
	const group = parts[1];
	const method = parts[2];
	if (!group || !method) throw new Error(`Invalid qualified: ${qualified}`);
	return [group, method];
}

/**
 * Guest-side wrapper template for service calls: receives a Reference $0 and
 * installs an async function that JSON-serialises args, calls the host, and
 * unpacks the envelope.
 */
const SERVICE_CALL_WRAPPER = dedent`
	(function(ref, group, method) {
		globalThis.defillama[group][method] = async function(args) {
			var env = await ref.apply(undefined, [JSON.stringify(args ?? {})], { result: { promise: true } });
			if (env.ok) return env.data;
			throw new Error(env.error);
		};
	})($0, $1, $2)
`;

/**
 * Guest-side wrapper template for async resolvers: spreads positional args and
 * awaits the host reference result.
 */
const ASYNC_RESOLVER_WRAPPER = dedent`
	(function(ref, prop) {
		globalThis.defillama[prop] = async function() {
			var a = Array.prototype.slice.call(arguments);
			var env = await ref.apply(undefined, a, { result: { promise: true } });
			if (env.ok) return env.data;
			throw new Error(env.error);
		};
	})($0, $1)
`;

/**
 * Installs a single service method on the guest context. The host-side body:
 *   1. Deserialises JSON args from the guest string,
 *   2. Races a *Raw() call against an AbortController timer,
 *   3. Returns an ExternalCopy({ ok, data | error }) envelope — never throws,
 *      so errors route back to the guest as catchable exceptions.
 */
async function installServiceCall(
	ctx: IVM.Context,
	ivm: typeof IVM,
	scope: ExecutionScope,
	spec: {
		qualified: string;
		parameters: z.ZodTypeAny;
		rawFn: (
			args: unknown,
			options: { signal: AbortSignal; timeout: number },
		) => Promise<unknown>;
		timeoutMs?: number;
	},
): Promise<void> {
	const abortMs = spec.timeoutMs ?? ABORT_MS;
	const axiosMs = abortMs + AXIOS_BUFFER_MS;
	const abortSeconds = Math.round(abortMs / 1000);
	const [group, method] = parseQualified(spec.qualified);
	const ref = new ivm.Reference(async (argsJson: string) => {
		if (scope.controller.signal.aborted) {
			return envelopeFail(
				ivm,
				`Execute scope cancelled before ${spec.qualified}`,
			);
		}
		if (!tryReserveBudget(scope)) {
			return envelopeFail(
				ivm,
				`Execute call budget exceeded (${scope.budget.max} calls per invocation): ${spec.qualified}`,
			);
		}
		await acquireSlot(scope);
		if (scope.controller.signal.aborted) {
			releaseSlot(scope);
			return envelopeFail(
				ivm,
				`Execute scope cancelled before ${spec.qualified}`,
			);
		}

		const controller = new AbortController();
		const onScopeAbort = () => controller.abort();
		scope.controller.signal.addEventListener("abort", onScopeAbort, {
			once: true,
		});
		/*
		 * Re-check after registering: if the scope aborted between the check above
		 * and addEventListener, the "abort" event already fired and our listener
		 * will never run — abort the child explicitly so the upstream call doesn't
		 * run to completion on a cancelled scope.
		 */
		if (scope.controller.signal.aborted) {
			controller.abort();
		}
		let timer: NodeJS.Timeout | undefined;
		const abortPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				controller.abort();
				reject(
					new Error(
						`DefiLlama call timed out after ${abortSeconds}s: ${spec.qualified}`,
					),
				);
			}, abortMs);
			timer.unref?.();
		});
		try {
			const rawArgs: unknown =
				argsJson === undefined ? {} : JSON.parse(argsJson);
			const parsed = spec.parameters.safeParse(rawArgs);
			if (!parsed.success) {
				return envelopeFail(
					ivm,
					`Invalid arguments for ${spec.qualified}: ${parsed.error.message}`,
				);
			}
			const result = await Promise.race([
				spec.rawFn(parsed.data, {
					signal: controller.signal,
					timeout: axiosMs,
				}),
				abortPromise,
			]);
			return envelopeOk(ivm, result);
		} catch (err) {
			const e = err as Error & { code?: string };
			let message: string;
			if (
				typeof e.message === "string" &&
				e.message.startsWith("DefiLlama call timed out after ")
			) {
				message = e.message;
			} else if (scope.controller.signal.aborted) {
				message = `Execute scope cancelled during ${spec.qualified}`;
			} else {
				const isAbort = controller.signal.aborted;
				const isAxiosTimeout =
					e.code === "ECONNABORTED" || e.code === "ETIMEDOUT";
				if (isAbort || isAxiosTimeout) {
					message = `DefiLlama call timed out after ${abortSeconds}s: ${spec.qualified}`;
				} else {
					message = e.message || String(err);
				}
			}
			return envelopeFail(ivm, message);
		} finally {
			scope.controller.signal.removeEventListener("abort", onScopeAbort);
			if (timer) clearTimeout(timer);
			releaseSlot(scope);
		}
	});
	await ctx.evalClosure(SERVICE_CALL_WRAPPER, [ref, group, method]);
}

/**
 * Installs an async resolver function on the guest context. Uses
 * ASYNC_RESOLVER_WRAPPER with ref.apply; the host-side Reference body awaits the
 * resolver and wraps the result (or thrown error) in an ExternalCopy envelope so
 * it never throws across the boundary.
 */
async function installResolver(
	ctx: IVM.Context,
	ivm: typeof IVM,
	spec: { name: string; fn: (...args: unknown[]) => unknown },
): Promise<void> {
	const { name, fn } = spec;
	const ref = new ivm.Reference(async (...args: unknown[]) => {
		try {
			return envelopeOk(ivm, await fn(...args));
		} catch (err) {
			return envelopeFail(ivm, (err as Error).message || String(err));
		}
	});
	await ctx.evalClosure(ASYNC_RESOLVER_WRAPPER, [ref, name]);
}

export async function installDefillamaClient(
	ctx: IVM.Context,
	scope: ExecutionScope,
): Promise<void> {
	const mod = await import("isolated-vm");
	const ivm = ((mod as unknown as { default?: typeof IVM }).default ??
		mod) as typeof IVM;

	// Ensure namespace objects exist
	const groups = new Set(
		TOOL_METADATA.map((m) => parseQualified(m.qualified)[0]),
	);
	for (const g of groups) {
		await ctx.evalClosure(
			`globalThis.defillama[$0] = globalThis.defillama[$0] || {};`,
			[g],
		);
	}

	// One bridge per metadata entry — see TOOL_METADATA.
	for (const m of TOOL_METADATA) {
		const rawFn = (await m.sandboxImpl()) as (
			args: unknown,
			options: { signal: AbortSignal; timeout: number },
		) => Promise<unknown>;
		await installServiceCall(ctx, ivm, scope, {
			qualified: m.qualified,
			parameters: m.parameters,
			rawFn,
			timeoutMs: m.timeoutMs,
		});
	}

	// 3 deterministic resolvers (all async).
	await installResolver(ctx, ivm, {
		name: "resolveChain",
		fn: (n: unknown) => resolveChain(n as string),
	});
	await installResolver(ctx, ivm, {
		name: "resolveProtocol",
		fn: (n: unknown) => resolveProtocol(n as string),
	});
	await installResolver(ctx, ivm, {
		name: "resolveStablecoin",
		fn: (n: unknown) => resolveStablecoin(n as string),
	});
}
