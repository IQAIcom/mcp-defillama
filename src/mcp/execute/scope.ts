// src/mcp/execute/scope.ts
//
// Per-`execute` invocation safety budget. Bounds (1) the total number of
// upstream service calls a single guest script can issue, (2) how many run
// concurrently against the gateway, and (3) the lifetime of in-flight host
// callbacks so fire-and-forget calls don't outlive the isolate.
//
// The cap protects against prompt-injected or buggy agents fanning out
// authenticated requests beyond what a single MCP tool call can reasonably
// need. Defaults are generous for legitimate Promise.all-style work; both
// limits are env-overridable for tests (DEFILLAMA_MCP_EXECUTE_BUDGET /
// DEFILLAMA_MCP_EXECUTE_CONCURRENCY) — internal test knobs, not a public
// configuration surface; intentionally omitted from the README.

const DEFAULT_BUDGET = 100;
const DEFAULT_CONCURRENCY = 10;

export type ExecutionScope = {
	controller: AbortController;
	budget: { used: number; max: number };
	semaphore: { current: number; max: number; queue: Array<() => void> };
};

export function createExecutionScope(): ExecutionScope {
	const max =
		Number(process.env.DEFILLAMA_MCP_EXECUTE_BUDGET) || DEFAULT_BUDGET;
	const concurrency =
		Number(process.env.DEFILLAMA_MCP_EXECUTE_CONCURRENCY) ||
		DEFAULT_CONCURRENCY;
	return {
		controller: new AbortController(),
		budget: { used: 0, max },
		semaphore: { current: 0, max: concurrency, queue: [] },
	};
}

/** Returns false when the budget is exhausted; otherwise consumes one slot. */
export function tryReserveBudget(scope: ExecutionScope): boolean {
	if (scope.budget.used >= scope.budget.max) return false;
	scope.budget.used += 1;
	return true;
}

/**
 * Wait for a concurrency slot. Resolves immediately if one is free.
 *
 * Invariant: `current` is the number of *held* permits (a holder is anything
 * between a resolved acquireSlot and its matching releaseSlot). A queued waiter
 * holds nothing until a permit is handed to it.
 *
 * The permit is granted by whoever wakes us — releaseSlot (direct hand-off) or
 * cancelScope — so we must NOT increment `current` after the await. Doing so
 * was the source of the over-subscription race: releaseSlot decremented and
 * signalled, but the waiter only re-incremented on its next microtask, leaving
 * a window where a fast-path acquireSlot could push `current` past `max`.
 */
export async function acquireSlot(scope: ExecutionScope): Promise<void> {
	if (scope.semaphore.current < scope.semaphore.max) {
		scope.semaphore.current += 1;
		return;
	}
	await new Promise<void>((resolve) => scope.semaphore.queue.push(resolve));
}

export function releaseSlot(scope: ExecutionScope): void {
	const next = scope.semaphore.queue.shift();
	if (next) {
		/*
		 * Hand the permit straight to the next waiter: net change to `current`
		 * is zero (one holder out, one in), closing the race window.
		 */
		next();
	} else {
		scope.semaphore.current -= 1;
	}
}

/**
 * Abort the scope and drain queued waiters. Each waiter resolves and is
 * expected to re-check `scope.controller.signal.aborted` before doing work.
 * Idempotent.
 *
 * A drained waiter becomes a holder (it proceeds and will call releaseSlot), so
 * we grant it a permit here — otherwise its eventual release would drive
 * `current` negative.
 */
export function cancelScope(scope: ExecutionScope): void {
	if (scope.controller.signal.aborted) return;
	scope.controller.abort();
	const waiters = scope.semaphore.queue.splice(0);
	for (const r of waiters) {
		scope.semaphore.current += 1;
		r();
	}
}
