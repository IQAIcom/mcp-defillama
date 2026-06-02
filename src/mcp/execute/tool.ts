// src/mcp/execute/tool.ts
//
// MCP tool definition for `execute`. Loaded statically by the server entry,
// but the heavy lifting (isolated-vm) is dynamic-imported on first call so
// the addon doesn't load at server startup.

import { z } from "zod";
import type { SandboxResult } from "./sandbox.js";
import { cancelScope, createExecutionScope } from "./scope.js";

const PARAMS = z.object({
	code: z
		.string()
		.describe(
			"JavaScript source defining async function run(defillama). No type annotations.",
		),
	intent: z
		.string()
		.optional()
		.describe("Optional: what task you're trying to perform. Telemetry only."),
});

export const executeTool = {
	name: "execute",
	description:
		"Run async JavaScript against a pre-wired DefiLlama client. Define `async function run(defillama) { ... }`; the JSON-serializable return value is sent back plus console.log output. The `defillama` client mirrors the services: `defillama.protocol`, `defillama.dex`, `defillama.fees`, `defillama.options`, `defillama.stablecoin`, `defillama.price`, `defillama.yield`, `defillama.blockchain`, plus `defillama.resolveChain` / `defillama.resolveProtocol` / `defillama.resolveStablecoin` helpers. JavaScript only (no type annotations); variables don't persist between calls; no fs, no network outside the client.",
	parameters: PARAMS,
	annotations: { readOnlyHint: false },
	execute: async (args: z.infer<typeof PARAMS>) => {
		let sandboxResult: SandboxResult;
		const scope = createExecutionScope();
		try {
			const [{ runInSandbox }, { installDefillamaClient }] = await Promise.all([
				import("./sandbox.js"),
				import("./client.js"),
			]); //Both of these use isolated-vm which can fail to load on some platforms, so do them together in a try/catch
			sandboxResult = await runInSandbox(args.code, (ctx) =>
				installDefillamaClient(ctx, scope),
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const isLoadFailure =
				/isolated-vm|MODULE_NOT_FOUND|self-register|cannot find module/i.test(
					msg,
				);
			sandboxResult = {
				ok: false,
				error: isLoadFailure
					? `isolated-vm native module failed to load. On Alpine/ARM/older Node, run 'pnpm rebuild isolated-vm'. Original error: ${msg}`
					: msg,
				log_lines: [],
				err_lines: err instanceof Error && err.stack ? [err.stack] : [],
			};
		} finally {
			cancelScope(scope);
		}

		/**
		 * JSON.stringify can throw on BigInt, circular refs, or other non-JSON
		 * values returned from the sandbox. Normalize to the {ok:false} envelope
		 * so the MCP contract ("always return a valid envelope") holds.
		 */
		let inner: string;
		let isError: boolean;
		try {
			inner = JSON.stringify(sandboxResult);
			isError = !sandboxResult.ok;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			inner = JSON.stringify({
				ok: false,
				error: `Result is not JSON-serializable: ${msg}`,
				log_lines: sandboxResult.log_lines,
				err_lines: sandboxResult.err_lines,
			});
			isError = true;
		}
		return {
			content: [{ type: "text" as const, text: inner }],
			isError,
		};
	},
};
