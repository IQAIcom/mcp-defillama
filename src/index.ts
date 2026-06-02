#!/usr/bin/env -S node --no-node-snapshot
import { createRequire } from "node:module";
import { FastMCP } from "fastmcp";
import { createChildLogger } from "./lib/utils/logger.js";
import { endpointTools } from "./mcp/endpoints/tools.js";
import { executeTool } from "./mcp/execute/tool.js";
import { INSTRUCTIONS } from "./mcp/instructions/instructions.generated.js";
import { searchDocsTool } from "./mcp/search-docs/tool.js";
import { dynamicConvenienceTools } from "./mcp/tools.js";

const logger = createChildLogger("DefiLlama MCP");

const require = createRequire(import.meta.url);

type SemverString = `${number}.${number}.${number}`;
function assertSemver(v: string): asserts v is SemverString {
	if (!/^\d+\.\d+\.\d+$/.test(v)) {
		throw new Error(
			`package.json version "${v}" is not a major.minor.patch semver string`,
		);
	}
}
const { version: rawVersion } = require("../package.json") as {
	version: string;
};
assertSemver(rawVersion);
const version: SemverString = rawVersion;

function dynamicToolsEnabled(): boolean {
	if (process.env.DEFILLAMA_MCP_TOOLS === "dynamic") return true;
	if (process.argv.includes("--tools=dynamic")) return true;
	return false;
}

async function main() {
	const server = new FastMCP({
		name: "DefiLlama MCP Server",
		version,
		instructions: INSTRUCTIONS,
	});

	type RegisteredTool = Parameters<typeof server.addTool>[0];
	const tools: RegisteredTool[] = [
		executeTool as unknown as RegisteredTool,
		searchDocsTool as unknown as RegisteredTool,
	];
	if (dynamicToolsEnabled()) {
		tools.push(
			...(dynamicConvenienceTools as unknown as RegisteredTool[]),
			...(endpointTools as unknown as RegisteredTool[]),
		);
		logger.info(
			"Dynamic tools enabled (--tools=dynamic or DEFILLAMA_MCP_TOOLS=dynamic)",
		);
	}
	for (const tool of tools) server.addTool(tool);

	try {
		await server.start({ transportType: "stdio" });
	} catch (error) {
		logger.error("Failed to start server", error as Error);
		process.exit(1);
	}
}

main().catch((error) => {
	logger.error("Unexpected error occurred", error);
	process.exit(1);
});
