// src/adk/index.ts
//
// ADK adapter: expose the Code Mode tools as @iqai/adk BaseTools so they can
// be dropped into an ADK agent. Thin pass-through — no query plumbing. The new
// tools return the FastMCP shape `{ content: [{ type, text }], isError }`; ADK
// agents consume a plain value, so we unwrap the text payload.

import { type BaseTool, createTool } from "@iqai/adk";
import type { z } from "zod";
import { endpointTools } from "../mcp/endpoints/tools.js";
import { executeTool } from "../mcp/execute/tool.js";
import { searchDocsTool } from "../mcp/search-docs/tool.js";
import { dynamicConvenienceTools } from "../mcp/tools.js";

type CodeModeTool = {
	name: string;
	description: string;
	parameters: z.ZodTypeAny;
	execute: (args: never) => Promise<{
		content?: Array<{ type: string; text: string }>;
		isError?: boolean;
	}>;
};

function wrap(tool: CodeModeTool): BaseTool {
	return createTool({
		name: tool.name,
		description: tool.description,
		schema: tool.parameters as z.ZodSchema<Record<string, unknown>>,
		fn: async (args) => {
			const result = await tool.execute(args as never);
			/*
			 * New tools return FastMCP { content:[{type:"text",text}], isError }.
			 * ADK agents consume a plain value — return the text payload. Note the
			 * `isError` flag is intentionally dropped here: errors are conveyed
			 * in-band within the returned text (each tool serializes its own
			 * {ok:false}/{error} payload), so ADK callers get the string, not
			 * structured error signalling.
			 */
			return result?.content?.[0]?.text ?? JSON.stringify(result);
		},
	});
}

/**
 * Get the DefiLlama Code Mode tools as ADK BaseTool instances.
 * By default returns `execute` + `search_docs`. Pass `{ dynamic: true }` to
 * also include the four dynamic tools (defillama_resolve, list_endpoints,
 * get_endpoint_schema, invoke_endpoint).
 */
export function getDefillamaTools(opts?: { dynamic?: boolean }): BaseTool[] {
	const tools: CodeModeTool[] = [
		executeTool as CodeModeTool,
		searchDocsTool as CodeModeTool,
	];
	if (opts?.dynamic) {
		tools.push(
			...(dynamicConvenienceTools as unknown as CodeModeTool[]),
			...(endpointTools as unknown as CodeModeTool[]),
		);
	}
	return tools.map(wrap);
}
