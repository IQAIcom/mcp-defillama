import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

// Load .env from the SCRIPT's directory's parent (repo root for dev,
// install-dir parent for pnpm dlx), not just process cwd — MCP hosts like
// Claude Desktop spawn `node` with a cwd that isn't the repo, so the default
// dotenv.config() would never find a developer's .env.
// quiet: true suppresses dotenv@17's "[dotenv@17.x.x] injecting env..." stdout
// banner, which would otherwise corrupt the MCP JSON-RPC stream over stdio.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ quiet: true, path: path.resolve(scriptDir, "../.env") });
// Also load from cwd as a fallback (no-op if the file above already set vars
// — dotenv's default is { override: false }).
config({ quiet: true });

// All fields are optional: DefiLlama's public API works unauthenticated, so
// the server starts with no env at all. Set IQ_GATEWAY_* to route upstream
// calls through the IQ Gateway (caching), or DEFILLAMA_API_KEY for a direct
// authenticated key. DEFILLAMA_MCP_TOOLS=dynamic opts into the four dynamic
// tools (also toggled by the --tools=dynamic CLI flag).
const envSchema = z.object({
	IQ_GATEWAY_URL: z.url().optional(),
	IQ_GATEWAY_KEY: z.string().min(1).optional(),

	DEFILLAMA_API_KEY: z.string().min(1).optional(),

	DEFILLAMA_MCP_TOOLS: z.enum(["dynamic"]).optional(),
});

export const env = envSchema.parse(process.env);
