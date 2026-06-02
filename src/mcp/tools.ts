// src/mcp/tools.ts
//
// Top-level entity resolver. Gated behind --tools=dynamic (along with the
// endpoint dispatch triad). The underlying lookups are deterministic catalog
// matches — kept as a top-level tool rather than reachable only via execute
// because spinning up an isolated-vm isolate just to resolve "BSC" -> "bsc"
// is overhead the agent shouldn't pay.

import { z } from "zod";
import {
	resolveChain,
	resolveProtocol,
	resolveStablecoin,
} from "../lib/entity-resolver.js";

const RESOLVE_PARAMS = z.object({
	kind: z
		.enum(["chain", "protocol", "stablecoin"])
		.describe("Entity type to resolve."),
	query: z.string().describe("Free-text name, e.g. 'BSC', 'Lido', 'USDC'."),
});

export const resolveTool = {
	name: "defillama_resolve",
	description:
		"Resolve a human-readable entity name to its DefiLlama identifier. For kind='chain' returns { resolved: { name, slug } }; for kind='protocol' returns { resolved: '<slug>' }; for kind='stablecoin' returns { resolved: '<id>' }. On a miss returns { resolved: null, error: '...' } (not an error).",
	parameters: RESOLVE_PARAMS,
	annotations: { readOnlyHint: true },
	execute: async (args: z.infer<typeof RESOLVE_PARAMS>) => {
		const ok = (resolved: unknown) => ({
			content: [{ type: "text" as const, text: JSON.stringify({ resolved }) }],
			isError: false,
		});
		const miss = (error: string) => ({
			content: [
				{
					type: "text" as const,
					text: JSON.stringify({ resolved: null, error }),
				},
			],
			isError: false,
		});

		switch (args.kind) {
			case "chain": {
				const resolved = await resolveChain(args.query);
				return resolved
					? ok(resolved)
					: miss(
							`Could not resolve '${args.query}' as a chain. Try the exact chain name or slug (Ethereum, BSC, Polygon, …).`,
						);
			}
			case "protocol": {
				const resolved = await resolveProtocol(args.query);
				return resolved
					? ok(resolved)
					: miss(
							`Could not resolve '${args.query}' as a protocol. Try the exact protocol name, symbol, or slug (e.g. 'lido', 'aave-v3').`,
						);
			}
			case "stablecoin": {
				const resolved = await resolveStablecoin(args.query);
				return resolved
					? ok(resolved)
					: miss(
							`Could not resolve '${args.query}' as a stablecoin. Try the exact symbol, name, or numeric id (e.g. 'USDC', 'USDT').`,
						);
			}
		}
	},
};

export const dynamicConvenienceTools = [resolveTool];
