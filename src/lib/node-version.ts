/*
 * Runtime Node-version preflight. We require Node >= 22 (isolated-vm 6.x), but
 * the bin's `env -S node` shebang resolves whatever node is first in the
 * client's PATH. Under an older Node, undici (pulled in transitively by
 * fastmcp) throws a cryptic `ReferenceError: File is not defined` before any of
 * our code runs. This pure helper lets src/index.ts fail fast with an
 * actionable message *before* importing anything that loads undici.
 *
 * Kept dependency-free and side-effect-free so importing it can never trigger
 * the very crash it guards against.
 */

export const MIN_NODE_MAJOR = 22;

export type NodeVersionCheck = { ok: true } | { ok: false; message: string };

/**
 * Checks a Node version string (e.g. "v18.17.1" or "22.0.0") against the
 * minimum supported major. Fails open on an unparseable string so a real
 * runtime is never wrongly blocked.
 */
export function checkNodeVersion(
	version?: string | null,
	minMajor: number = MIN_NODE_MAJOR,
): NodeVersionCheck {
	// A missing/empty version is "can't determine" — fail open rather than block.
	if (!version) return { ok: true };
	// Extract the leading major-version digits — handles full semver ("22.17.1"),
	// a bare major ("22"), and prerelease/nightly suffixes ("v22.0.0-nightly",
	// "v18-nightly"). A string with no leading digits yields no match → fail open.
	const match = /^v?(\d+)/.exec(version);
	if (!match) return { ok: true };

	const major = Number(match[1]);
	if (major >= minMajor) return { ok: true };

	return {
		ok: false,
		message:
			`@iqai/defillama-mcp requires Node >= ${minMajor} (running ${version}).\n` +
			`Your MCP client likely launched an older Node from PATH. Point it at an ` +
			`absolute Node >= ${minMajor} binary — see the "Troubleshooting" section of ` +
			`the README.`,
	};
}
