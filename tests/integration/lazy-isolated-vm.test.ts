// tests/integration/lazy-isolated-vm.test.ts
//
// Proves the execute tool degrades gracefully when isolated-vm cannot be
// resolved. A child node process imports the BUILT dist/mcp/execute/tool.js
// under a resolve hook that hard-fails any `import("isolated-vm")`, then calls
// executeTool.execute(...). The lazy import inside the sandbox/client fails,
// and the tool must catch it and return the canonical {ok:false} envelope
// (never crash the process).
//
// (The full server's two-tool surface + dynamic gating is asserted by the
// Phase 8 setup-smoke integration test; this Phase 5 test scopes itself to the
// execute tool's lazy-load contract, which is what the sandbox/bridge owns.)

import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const registerPath = path.resolve(
	repoRoot,
	"tests/integration/no-isolated-vm.register.mjs",
);
const toolPath = path.resolve(repoRoot, "dist/mcp/execute/tool.js");

describe("lazy isolated-vm", () => {
	it("execute degrades gracefully (clean {ok:false}) when isolated-vm cannot resolve", () => {
		/*
		 * Marker-delimit the JSON so any incidental stdout noise (e.g. the dotenv
		 * startup banner) doesn't corrupt the parse.
		 */
		const script = `
			import { executeTool } from ${JSON.stringify(toolPath)};
			const res = await executeTool.execute({ code: "async function run(){ return 1; }" });
			process.stdout.write("<<<RESULT>>>" + res.content[0].text + "<<<END>>>");
		`;
		const res = spawnSync(
			"node",
			[
				"--no-node-snapshot",
				"--import",
				registerPath,
				"--input-type=module",
				"-e",
				script,
			],
			{
				cwd: mkdtempSync(path.join(tmpdir(), "defillama-mcp-lazy-")),
				env: {
					PATH: process.env.PATH ?? "",
					NODE_ENV: "test",
					DOTENV_CONFIG_PATH: "/dev/null",
					DOTENV_CONFIG_QUIET: "true",
				},
				timeout: 20_000,
			},
		);

		// The process itself must exit cleanly — graceful degradation, no crash.
		expect(res.status, `stderr: ${res.stderr?.toString()}`).toBe(0);
		const out = res.stdout.toString();
		const match = out.match(/<<<RESULT>>>([\s\S]*?)<<<END>>>/);
		expect(
			match,
			`stdout: ${out}\nstderr: ${res.stderr?.toString()}`,
		).not.toBeNull();
		const inner = JSON.parse((match as RegExpMatchArray)[1]) as {
			ok: boolean;
			error?: string;
		};
		expect(inner.ok).toBe(false);
		expect(inner.error).toMatch(/isolated-vm native module failed to load/);
		expect(inner.error).toMatch(/pnpm rebuild isolated-vm/);
	}, 30_000);
});
