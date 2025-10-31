#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { createChildLogger } from "./lib/utils/logger.js";
import { defillamaTools } from "./tools/index.js";

const logger = createChildLogger("DefiLlama MCP");

/**
 * Initializes and starts the DefiLlama MCP (Model Context Protocol) Server.
 *
 * This server provides comprehensive DeFi data including TVL, prices, yields,
 * volumes, and protocol metrics through the MCP protocol. The server communicates
 * via stdio transport, making it suitable for integration with MCP clients and AI agents.
 */
async function main() {
	const server = new FastMCP({
		name: "DefiLlama MCP Server",
		version: "1.0.0",
	});

	// Register all tools
	type RegisteredTool = Parameters<typeof server.addTool>[0];
	const registeredTools = defillamaTools as ReadonlyArray<RegisteredTool>;
	for (const tool of registeredTools) {
		server.addTool(tool);
	}

	try {
		await server.start({
			transportType: "stdio",
		});
	} catch (error) {
		logger.error("Failed to start server", error as Error);
		process.exit(1);
	}
}

main().catch((error) => {
	logger.error("Unexpected error occurred", error);
	process.exit(1);
});
