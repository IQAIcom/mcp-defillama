import { describe, expect, it } from "vitest";
import { checkNodeVersion } from "./node-version.js";

describe("checkNodeVersion", () => {
	it("accepts the minimum supported major", () => {
		expect(checkNodeVersion("v22.17.1")).toEqual({ ok: true });
	});

	it("accepts a newer major", () => {
		expect(checkNodeVersion("v24.0.0")).toEqual({ ok: true });
	});

	it("tolerates a version string without the leading 'v'", () => {
		expect(checkNodeVersion("22.0.0")).toEqual({ ok: true });
	});

	it("handles a bare major with no minor/patch", () => {
		expect(checkNodeVersion("22")).toEqual({ ok: true });
		expect(checkNodeVersion("18").ok).toBe(false);
	});

	it("rejects an older major with an actionable message", () => {
		const result = checkNodeVersion("v18.17.1");
		expect(result.ok).toBe(false);
		// message must name both the requirement and what's actually running
		expect(result.message).toContain(">= 22");
		expect(result.message).toContain("v18.17.1");
	});

	it("honours a custom minimum major", () => {
		expect(checkNodeVersion("v18.17.1", 16)).toEqual({ ok: true });
		expect(checkNodeVersion("v18.17.1", 20).ok).toBe(false);
	});

	it("fails open on an unparseable version (never wrongly blocks a real runtime)", () => {
		expect(checkNodeVersion("not-a-version")).toEqual({ ok: true });
	});
});
