import { describe, expect, it } from "vitest";
import {
	acquireSlot,
	cancelScope,
	createExecutionScope,
	type ExecutionScope,
	releaseSlot,
	tryReserveBudget,
} from "./scope.js";

/** Drain pending microtasks so awaited continuations run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("scope semaphore", () => {
	it("never exceeds max concurrency under the release→acquire race", async () => {
		const scope = createExecutionScope();
		scope.semaphore.max = 2;

		// Saturate: 2 holders.
		await acquireSlot(scope);
		await acquireSlot(scope);
		expect(scope.semaphore.current).toBe(2);

		// A third caller must queue.
		let thirdResumed = false;
		const third = acquireSlot(scope).then(() => {
			thirdResumed = true;
		});
		expect(scope.semaphore.queue.length).toBe(1);

		// Release one slot. This hands the permit to the queued waiter. The race
		// we're guarding against: a fast-path acquireSlot slipping in before the
		// waiter resumes and pushing current past max.
		releaseSlot(scope);

		let fourthResumed = false;
		const fourth = acquireSlot(scope).then(() => {
			fourthResumed = true;
		});

		await flush();
		await third;

		// The waiter (third) got the freed permit; the fourth caller must queue.
		expect(thirdResumed).toBe(true);
		expect(fourthResumed).toBe(false);
		expect(scope.semaphore.current).toBe(2);
		expect(scope.semaphore.current).toBeLessThanOrEqual(scope.semaphore.max);

		// Drain the rest cleanly.
		releaseSlot(scope);
		await flush();
		await fourth;
		expect(scope.semaphore.current).toBe(2);
		releaseSlot(scope);
		releaseSlot(scope);
		expect(scope.semaphore.current).toBe(0);
	});

	it("keeps permit accounting balanced when cancelScope drains waiters", async () => {
		const scope = createExecutionScope();
		scope.semaphore.max = 2;

		await acquireSlot(scope);
		await acquireSlot(scope);

		const waiters = [acquireSlot(scope), acquireSlot(scope)];
		expect(scope.semaphore.queue.length).toBe(2);

		cancelScope(scope);
		await flush();
		await Promise.all(waiters);

		// Every acquirer (2 holders + 2 drained waiters) now releases; current
		// must land exactly at 0, never negative.
		releaseSlot(scope); // drained waiter
		releaseSlot(scope); // drained waiter
		releaseSlot(scope); // original holder
		releaseSlot(scope); // original holder
		expect(scope.semaphore.current).toBe(0);
	});

	it("tryReserveBudget consumes until exhausted", () => {
		const scope: ExecutionScope = createExecutionScope();
		scope.budget.max = 2;
		expect(tryReserveBudget(scope)).toBe(true);
		expect(tryReserveBudget(scope)).toBe(true);
		expect(tryReserveBudget(scope)).toBe(false);
	});
});
