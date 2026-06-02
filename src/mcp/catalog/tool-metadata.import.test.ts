// src/mcp/catalog/tool-metadata.import.test.ts
//
// Proves that importing the BUILT tool-metadata.js does NOT load
// services/index.js (which constructs the eight service singletons at load).
// That deferral is exactly what lazyMethod's dynamic import buys us.
//
// The probe runs in a child Node process under a resolve hook that hard-fails
// if services/index.js is ever resolved. DefiLlama's env.ts makes every field
// optional, so the "scrubbed env throws" trick does not apply here — the
// resolve hook is the deterministic invariant. (A fresh tmp cwd +
// DOTENV_CONFIG_PATH=/dev/null are belt-and-braces.)

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("tool-metadata side-effect-freeness", () => {
	it("imports without loading services/index.js (no singleton construction)", () => {
		const root = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../..",
		);
		const dist = path.resolve(root, "dist/mcp/catalog/tool-metadata.js");
		// This probe imports the BUILT artifact, so a prior `tsc` is required.
		// `pnpm test` covers it via pretest; bare `pnpm vitest run` does NOT —
		// run `pnpm build && pnpm vitest run` instead. Fail loudly if dist is missing.
		expect(
			existsSync(dist),
			`Built artifact missing: ${dist}. Run \`pnpm build\` first (or \`pnpm test\`, which builds via pretest).`,
		).toBe(true);
		const register = path.resolve(
			root,
			"tests/probes/forbid-services-index.register.mjs",
		);
		const res = spawnSync(
			"node",
			[
				"--import",
				register,
				"--input-type=module",
				"-e",
				`import { TOOL_METADATA } from ${JSON.stringify(dist)}; process.stdout.write(String(TOOL_METADATA.length));`,
			],
			{
				cwd: mkdtempSync(path.join(tmpdir(), "dfl-meta-")),
				env: {
					PATH: process.env.PATH ?? "",
					DOTENV_CONFIG_PATH: "/dev/null",
				},
				timeout: 8_000,
			},
		);
		expect(
			res.error,
			`spawnSync failed: ${res.error?.message ?? "no error reported"}; stderr: ${res.stderr?.toString()}`,
		).toBeUndefined();
		// resolve-hook throw → non-zero exit if services/index.js was loaded
		expect(res.status, `stderr: ${res.stderr?.toString()}`).toBe(0);
		expect(res.stdout.toString()).toBe("23");
	});
});
