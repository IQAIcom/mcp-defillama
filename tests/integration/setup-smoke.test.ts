// tests/integration/setup-smoke.test.ts
//
// Spawns the BUILT dist/index.js as an MCP server over stdio, performs the
// JSON-RPC initialize handshake, lists the tools, and asserts the surface.
// Default = exactly `execute` + `search_docs`; with DEFILLAMA_MCP_TOOLS=dynamic
// in the child env the four dynamic tools are added.

import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const SERVER = path.join(ROOT, "dist", "index.js");

let child: ChildProcess | undefined;

afterEach(() => {
	child?.kill("SIGKILL");
	child = undefined;
});

/** Spawn the server, handshake, list tools, return the sorted tool names. */
function listTools(extraEnv: Record<string, string>): Promise<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		// Build a clean env that does NOT inherit DEFILLAMA_MCP_TOOLS from the
		// caller, then layer the explicit overrides on top.
		const env = { ...process.env, ...extraEnv } as NodeJS.ProcessEnv;
		if (!("DEFILLAMA_MCP_TOOLS" in extraEnv)) delete env.DEFILLAMA_MCP_TOOLS;

		const proc = spawn(process.execPath, ["--no-node-snapshot", SERVER], {
			stdio: ["pipe", "pipe", "pipe"],
			env,
		});
		child = proc;

		let stderr = "";
		proc.stderr?.on("data", (d) => {
			stderr += d.toString();
		});
		proc.on("error", reject);
		// Fail fast (with stderr) if the server exits before we get a tools/list
		// reply — otherwise a broken build would hang for the full 20s timeout.
		proc.on("close", (code) => {
			if (code !== null && code !== 0) {
				reject(
					new Error(
						`server exited early with code ${code}. stderr:\n${stderr}`,
					),
				);
			}
		});

		const send = (o: unknown) => proc.stdin?.write(`${JSON.stringify(o)}\n`);

		let buf = "";
		proc.stdout?.on("data", (chunk) => {
			buf += chunk.toString();
			let nl: number;
			// biome-ignore lint/suspicious/noAssignInExpressions: line-buffered JSON-RPC framing
			while ((nl = buf.indexOf("\n")) >= 0) {
				const line = buf.slice(0, nl).trim();
				buf = buf.slice(nl + 1);
				if (!line) continue;
				let msg: { id?: number; result?: { tools?: { name: string }[] } };
				try {
					msg = JSON.parse(line);
				} catch {
					continue; // ignore any non-JSON banner lines
				}
				if (msg.id === 1) {
					send({ jsonrpc: "2.0", method: "notifications/initialized" });
					send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
				}
				if (msg.id === 2) {
					const names = (msg.result?.tools ?? []).map((t) => t.name).sort();
					resolve(names);
					return;
				}
			}
		});

		send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "smoke", version: "0.0.0" },
			},
		});

		setTimeout(() => {
			reject(new Error(`timed out listing tools. stderr:\n${stderr}`));
		}, 20_000).unref?.();
	});
}

describe("server smoke (built dist/index.js)", () => {
	it("default surface is exactly execute + search_docs", async () => {
		const names = await listTools({});
		expect(names).toEqual(["execute", "search_docs"]);
	}, 30_000);

	it("DEFILLAMA_MCP_TOOLS=dynamic adds the four dynamic tools", async () => {
		const names = await listTools({ DEFILLAMA_MCP_TOOLS: "dynamic" });
		expect(names).toEqual(
			[
				"defillama_resolve",
				"execute",
				"get_endpoint_schema",
				"invoke_endpoint",
				"list_endpoints",
				"search_docs",
			].sort(),
		);
	}, 30_000);
});
