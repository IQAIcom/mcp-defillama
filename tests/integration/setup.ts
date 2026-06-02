// tests/integration/setup.ts (loaded via vitest config setupFiles)
import { vi } from "vitest";

/**
 * 1. Neutralize dotenv BEFORE env.ts is imported. Default dotenv.config()
 *    populates keys that are undefined from a .env file — so a `delete`
 *    without this mock would silently re-introduce IQ_GATEWAY_* from a
 *    developer's local .env.
 */
vi.mock("dotenv", () => ({ config: () => ({ parsed: {} }) }));

/**
 * 2. Delete the gateway/API env vars so tests exercise the direct-fetch
 *    branch. DefiLlama's env schema makes every field optional, so `undefined`
 *    (i.e. `delete`) resolves to the "unset" branch — empty strings would fail
 *    the `z.url().optional()` / `z.string().min(1).optional()` parse.
 */
delete process.env.IQ_GATEWAY_URL;
delete process.env.IQ_GATEWAY_KEY;
delete process.env.DEFILLAMA_API_KEY;
