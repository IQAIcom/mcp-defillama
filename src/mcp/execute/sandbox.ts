// src/mcp/execute/sandbox.ts
//
// Owns isolated-vm lifecycle, lazy load (cached), and the three-layer timeout
// policy (script timeout + outer Promise.race + per-call host timeout — see
// spec §2.1 step 5 and §2.2 step 3).
//
// MUST NOT be imported statically from anywhere reachable from server
// startup. Loaded dynamically by execute/tool.ts on first execute call.

import dedent from "dedent";
import type * as IVM from "isolated-vm";

// Lazy-load isolated-vm. CJS import normalization required — see spec §3.1.
let _ivm: typeof IVM | undefined;
async function getIvm() {
	if (_ivm) return _ivm;
	const mod = await import("isolated-vm");
	_ivm = ((mod as unknown as { default?: typeof IVM }).default ??
		mod) as typeof IVM;
	return _ivm;
}

const ISOLATE_MEMORY_MB = 128;
/**
 * Test-overridable for fast CI: `DEFILLAMA_MCP_SANDBOX_DEADLINE_MS=1000`.
 * Production callers leave it unset and get 30 s per the spec. This is a
 * test-time knob, not a public configuration surface — README intentionally
 * omits it.
 */
const SCRIPT_DEADLINE_MS =
	Number(process.env.DEFILLAMA_MCP_SANDBOX_DEADLINE_MS) || 30_000;
const BLOCKLIST = ["process.", "require(", "import(", "eval("];

export type SandboxResult = {
	ok: boolean;
	result?: unknown;
	error?: string;
	log_lines: string[];
	err_lines: string[];
};

/**
 * Runs JavaScript in a fresh V8 isolate with a `defillama` client injected.
 * @param code  Agent-supplied JS defining `async function run(defillama)`.
 * @param installClient Callback invoked with the isolate context; must
 *   install `globalThis.defillama.*` callbacks (see client.ts).
 */
export async function runInSandbox(
	code: string,
	installClient: (ctx: IVM.Context) => Promise<void>,
): Promise<SandboxResult> {
	// Step 1: blocklist
	for (const banned of BLOCKLIST) {
		if (code.includes(banned)) {
			return {
				ok: false,
				error: `Blocked identifier: '${banned}'`,
				log_lines: [],
				err_lines: [],
			};
		}
	}

	const logLines: string[] = [];
	const errLines: string[] = [];
	// Host-side timers created by the guest `sleep()` helper. We track both the
	// timer handle and the pending promise's `resolve` so the finally block can,
	// on disposal (abort/timeout/throw), clear the timer AND settle its promise —
	// clearing alone would leave the awaiting `sleep()` promise pending forever
	// (a slow leak per call killed mid-sleep).
	const activeTimers = new Set<{
		timer: NodeJS.Timeout;
		resolve: () => void;
	}>();

	/**
	 * Move getIvm() and Isolate construction INSIDE the try so any failure
	 * (native addon load error, Isolate constructor throwing on a bad memory
	 * limit, etc.) gets normalized into the {ok:false} SandboxResult contract.
	 * Callers — including executeTool but also future unit tests — must be
	 * able to rely on "runInSandbox never rejects."
	 */
	let ivm: typeof IVM | undefined;
	let isolate: IVM.Isolate | undefined;
	let disposed = false;
	const dispose = () => {
		if (!isolate || disposed) return;
		disposed = true;
		try {
			isolate.dispose();
		} catch {
			/* ignore */
		}
	};

	let timeoutHandle: NodeJS.Timeout | undefined;
	try {
		ivm = await getIvm();
		isolate = new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_MB });
		const context = await isolate.createContext();
		await context.global.set(
			"defillama",
			new ivm.ExternalCopy({}).copyInto({ release: true }),
		);

		/**
		 * console stubs + a bounded sleep helper. The instructions teach a retry
		 * loop with `await new Promise(r => setTimeout(r, ...))`, but isolated-vm
		 * doesn't install timer globals by default. Inject a sleep(ms) Callback
		 * capped at SCRIPT_DEADLINE_MS so guest code can't burn the whole budget
		 * on a single sleep. The outer Promise.race deadline still wins.
		 *
		 * console: guest joins all args into a single space-separated string
		 * BEFORE crossing the boundary. Otherwise applyIgnored spreads `a` as
		 * positional args to the host callback, and the callback's
		 * `(line: string)` signature drops everything after the first arg —
		 * execute is supposed to return console output, so dropped args =
		 * silently lost log lines.
		 */
		await context.evalClosure(
			dedent`
				const __fmt = (a) => a.map((x) => {
					if (typeof x === 'string') return x;
					try { return JSON.stringify(x); } catch { return String(x); }
				}).join(' ');
				globalThis.console = {
					log:   (...a) => $0.applyIgnored(undefined, [__fmt(a)]),
					warn:  (...a) => $0.applyIgnored(undefined, [__fmt(a)]),
					error: (...a) => $1.applyIgnored(undefined, [__fmt(a)]),
				};
				globalThis.sleep = (ms) => $2.apply(undefined, [ms], { result: { promise: true } });
			`,
			[
				new ivm.Reference((line: string) => logLines.push(line)),
				new ivm.Reference((line: string) => errLines.push(line)),
				new ivm.Reference(async (ms: number) => {
					const clamped = Math.max(
						0,
						Math.min(Number(ms) || 0, SCRIPT_DEADLINE_MS),
					);
					await new Promise<void>((r) => {
						const entry = {
							timer: undefined as unknown as NodeJS.Timeout,
							resolve: r,
						};
						entry.timer = setTimeout(() => {
							activeTimers.delete(entry);
							r();
						}, clamped);
						entry.timer.unref?.();
						activeTimers.add(entry);
					});
				}),
			],
		);

		await installClient(context);

		const wrapped = `(async () => { ${code}\nreturn await run(defillama); })()`;
		const script = await isolate.compileScript(wrapped);

		const value = await Promise.race([
			script.run(context, {
				timeout: SCRIPT_DEADLINE_MS,
				promise: true,
				copy: true,
			}),
			new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					dispose();
					reject(
						new Error(
							`Execute timed out after ${Math.round(SCRIPT_DEADLINE_MS / 1000)}s. No call to settle, or guest stuck in a non-yielding loop.`,
						),
					);
				}, SCRIPT_DEADLINE_MS);
				timeoutHandle.unref?.();
			}),
		]);

		return {
			ok: true,
			result: value as unknown,
			log_lines: logLines,
			err_lines: errLines,
		};
	} catch (err) {
		const e = err as Error & { code?: string };
		/**
		 * Isolate creation / native load failure path. When `isolate` is still
		 * undefined the failure came from getIvm() or the Isolate constructor,
		 * not from script execution. Surface as the canonical "isolated-vm
		 * native module failed to load…" wording from spec §4.4.
		 */
		if (!isolate) {
			return {
				ok: false,
				error: `isolated-vm native module failed to load. On Alpine/ARM/older Node, run 'pnpm rebuild isolated-vm'. Original error: ${e.message || String(err)}`,
				log_lines: logLines,
				err_lines: e.stack ? [e.stack] : [],
			};
		}
		// Isolate timeout from isolated-vm has message starting with "Script execution timed out"
		if (typeof e.message === "string" && /timed out/i.test(e.message)) {
			return {
				ok: false,
				error: e.message,
				log_lines: logLines,
				err_lines: errLines,
			};
		}
		return {
			ok: false,
			error: e.message || String(err),
			log_lines: logLines,
			err_lines: [...errLines, ...(e.stack ? [e.stack] : [])],
		};
	} finally {
		if (timeoutHandle) clearTimeout(timeoutHandle);
		// Clear pending sleep timers AND settle their promises so a guest killed
		// mid-sleep doesn't leave an unresolved host-side promise behind.
		for (const { timer, resolve } of activeTimers) {
			clearTimeout(timer);
			resolve();
		}
		activeTimers.clear();
		dispose();
	}
}
