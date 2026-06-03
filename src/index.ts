#!/usr/bin/env -S node --no-node-snapshot
/*
 * Preflight entry. This module must NOT statically import anything that pulls
 * in undici (fastmcp does) — undici references the `File` global (Node >= 20)
 * and would crash with a cryptic "File is not defined" on an older Node before
 * our guard could run. So we check the Node version against the requirement
 * first, then dynamically import the real server only once the runtime is OK.
 */
import { checkNodeVersion } from "./lib/node-version.js";

const check = checkNodeVersion(process.versions.node);
if (!check.ok) {
	process.stderr.write(`\n[defillama-mcp] ${check.message}\n\n`);
	process.exit(1);
}

const { start } = await import("./server.js");
await start().catch((error: unknown) => {
	// console.error prints the full error (incl. stack) to stderr, which is
	// separate from the stdio JSON-RPC channel — keep the stack for debugging.
	process.stderr.write("[defillama-mcp] Unexpected error during startup:\n");
	console.error(error);
	process.exit(1);
});
