---
"@iqai/defillama-mcp": patch
---

Plumb a per-method `timeoutMs` override through the execute client so the axios timeout scales with the wrapper deadline.

`ToolMetadata` gains an optional `timeoutMs?: number` field, and `execute/client.ts` now derives both the wrapper abort timer and the underlying axios timeout from it (`axiosMs = abortMs + AXIOS_BUFFER_MS`, defaulting to 5 s + 1 s = 6 s as before). Without this wiring, a `timeoutMs` override on a direct (non-aggregate) endpoint would be silently no-op'd by the hardcoded 6 s axios timeout — axios would reject before the wrapper budget ever applied.

No per-method overrides are set in this change; the behavior is bit-for-bit identical to before for every current endpoint (default `abortMs = 5_000`, `axiosMs = 6_000`, error message `"DefiLlama call timed out after 5s: …"`). The change unblocks tuning slow endpoints in follow-up PRs without re-touching the client.

Ported from debank-mcp 33a17d1 (the equivalent reference fix for the same Code Mode client).
