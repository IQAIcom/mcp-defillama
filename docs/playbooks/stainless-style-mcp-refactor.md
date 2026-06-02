# Stainless-style MCP refactor — bootstrap prompt

Paste the block below into a fresh Claude Code conversation rooted at
`/Users/aliusalaudeen/Documents/GitHub/defillama-mcp` (or whichever
sibling MCP repo you want to refactor next). It tells Claude where the
reference implementation lives, what shape to converge on, what to
copy verbatim, what to adapt, the gotchas to avoid, and the first
concrete task.

---

I want to refactor this MCP server to the same architecture I just shipped in a sibling project. That project is at `/Users/aliusalaudeen/Documents/GitHub/debank-mcp` — read it as the reference implementation. The work landed in PR #7 (`refactor/stainless-style-mcp-phase-one`) merged to `main`, plus cleanup PRs #8 and #9. Published as `@iqai/mcp-debank@1.0.0` on npm.

**Start with an audit, not a code change.** Read the current state of this project first, then propose a phased plan that I approve before any file touches.

## Target architecture

The pattern is "Stainless-style Code Mode" — same shape CoinGecko's Stainless MCP uses. Two tools by default, four more behind an opt-in flag.

**Default surface (always registered):**

- `execute` — sandboxed JavaScript in an `isolated-vm` V8 isolate against a pre-authenticated client. Agent writes async JS that chains multiple upstream calls, loops, joins, projects, and returns one value. Only the projected return crosses the V8 boundary.
- `search_docs` — local MiniSearch index over the full API surface + cookbook recipes, embedded into the binary at build time. No network, sub-millisecond.

**Dynamic-tools surface (gated behind `--tools=dynamic` or `<PROJECT>_MCP_TOOLS=dynamic`):**

- `<project>_resolve` — convert human-readable names (e.g. "BSC" → "bsc") to canonical IDs
- `list_endpoints` — list every endpoint with qualified names
- `get_endpoint_schema` — return params + response shape for one endpoint
- `invoke_endpoint` — call one endpoint with optional `jq_filter` for host-side projection (uses `jqts` — pure JS, no native binary)

Each `execute` invocation has an `ExecutionScope`:

- 100-call budget per invocation (env-tunable)
- 10-concurrent semaphore (env-tunable)
- 5 s per-call AbortController + 6 s axios timeout
- 30 s outer script wall clock
- `cancelScope` in `finally` aborts in-flight calls + drains queued waiters

Schema validation runs at the bridge (not just the tool layer): every guest `client.user.foo(args)` call zod-parses args against the endpoint's published schema before reaching the upstream service. Guest can't bypass `limit ≤ 100` etc.

Every host callback returns an `ExternalCopy` envelope `{ok, data|error}`. Never throw across the V8 boundary.

## Directory layout to mirror

```
src/
├── index.ts                 # FastMCP registration
├── env.ts                   # dotenv(quiet:true) loaded from script's dir, zod env schema
├── config.ts                # cache TTLs
├── services/                # one *.service.ts per domain; every public method is *Raw() returning JSON
├── lib/
│   ├── entity-resolver.ts   # resolveX functions backed by the API's own catalog endpoint
│   └── utils/               # logger, error-handler
├── mcp/
│   ├── tools.ts             # <project>_resolve (dynamic mode)
│   ├── execute/             # tool.ts, sandbox.ts, client.ts, scope.ts
│   ├── search-docs/         # tool.ts, embedded-index.ts (generated), cookbook/*.md
│   ├── endpoints/           # list_endpoints, get_endpoint_schema, invoke_endpoint
│   ├── instructions/        # instructions.md + instructions.generated.ts (generated)
│   └── legacy/              # tool-metadata.ts (side-effect-free) + response-schemas.ts
└── enums/                   # bundled catalogs (chains, etc.) as fallback when live API unavailable

scripts/
├── build-docs-index.ts
└── build-instructions.ts

tests/integration/           # end-to-end tests that spawn the built server
```

## Files to copy near-verbatim from `debank-mcp`

These have minimal project-specific content; copy and rename only.

- `src/mcp/execute/scope.ts` — copy as-is
- `src/mcp/execute/sandbox.ts` — copy as-is
- `src/mcp/execute/tool.ts` — copy as-is
- `src/mcp/execute/client.ts` — adapt the resolver list at the bottom only
- `src/mcp/search-docs/tool.ts` — copy as-is
- `scripts/build-docs-index.ts` — copy as-is
- `scripts/build-instructions.ts` — copy as-is
- `tests/integration/lazy-isolated-vm.test.ts` — adapt tool names + IDs only
- `tests/integration/no-isolated-vm.register.mjs` — copy as-is
- `tests/integration/no-isolated-vm.hooks.mjs` — copy as-is

## Files to rebuild fresh (API-shape-specific)

- `src/services/*.service.ts` — every upstream endpoint becomes a `*Raw(args, options?: RequestOptions): Promise<T>` method threading `signal` + `timeout` into axios
- `src/mcp/legacy/tool-metadata.ts` — one entry per endpoint with `{name, qualified, sandboxImpl: lazyMethod(...), description, parameters: z.object({...}), responseSchema, exampleCall}`. MUST stay side-effect-free at load — there's an integration test that enforces this
- `src/mcp/legacy/response-schemas.ts` — zod schemas for response shapes (for `get_endpoint_schema`)
- `src/mcp/instructions/instructions.md` — operational guide for agents (top operations, ID conventions, common patterns, sandbox constraints)
- `src/mcp/search-docs/cookbook/*.md` — recipe files for common multi-step workflows
- `src/lib/entity-resolver.ts` — project-appropriate resolvers (DefiLlama uses different chain identifiers than DeBank)
- `src/enums/` — bundled catalogs that match this project's domain

## Phased plan

Each phase is one PR; builds + tests green between phases.

| Phase | Scope |
|---|---|
| 0 | Audit current state + design doc in `docs/superpowers/specs/` |
| 1 | Service refactor — every method gets a `*Raw()` JSON variant; drop markdown wrappers if any |
| 2 | `tool-metadata.ts` + `response-schemas.ts` (with `import` test for side-effect-freeness) |
| 3 | `prebuild` scripts that generate `embedded-index.ts` + `instructions.generated.ts` |
| 4 | Sandbox + bridge (`execute/{sandbox,client,tool,scope}.ts`) |
| 5 | `search_docs` tool + cookbook recipes |
| 6 | Dynamic tools (`list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` with `jq_filter`) |
| 7 | Server entry rewrite — register default 2-tool surface + opt-in dynamic; delete legacy 30-tool surface |
| 8 | Entity resolver using the API's own catalog endpoint, cached, with alias table for ambiguous names only |
| 9 | README + screenshots (mirror `debank-mcp`'s structure: Architecture diagram + Mermaid sequence diagram + Safety limits + jq_filter + Error envelopes + Screenshots) |

## Gotchas to avoid (each one cost me hours)

1. **`dotenv@17` prints a banner to stdout** that corrupts the MCP JSON-RPC stream over stdio. Always use `config({quiet: true})`.
2. **dotenv reads from `process.cwd()`** but MCP hosts spawn from a different cwd. Resolve the `.env` path relative to `import.meta.url` (script's directory's parent).
3. **Claude Desktop picks Node 18 from nvm PATH** even when you want Node 22. Use absolute path to v22 in the `"command"` field.
4. **`node-jq` needs a downloaded native binary** that pnpm skips in CI. Use `jqts` (pure JS) instead. Unwrap single-output streams to match jq CLI semantics.
5. **`isolated-vm` build fails on Alpine/ARM**, killing server startup. Declare it in `optionalDependencies` + lazy-import it in `execute/tool.ts`. Server still starts; only `execute` is disabled.
6. **CJS interop with `isolated-vm` under NodeNext**: `((mod as unknown as {default?:T}).default ?? mod) as T`.
7. **Throwing from a host callback corrupts the isolate.** Always return `envelopeFail(ivm, message)`.
8. **`console.log` in guest only delivers the first arg** to host with default wiring. Format-and-join inside the isolate first via a small `__fmt` helper before `applyIgnored`.
9. **Guest `sleep(ms)` keeps Node event loop alive** after sandbox dispose. Track timers in a Set + `.unref()` + clear them in `finally`.
10. **AbortController race**: scope may abort between the post-`acquireSlot` check and `addEventListener`. Re-check `signal.aborted` synchronously immediately after the listener attaches; explicitly abort the child controller if so.
11. **LLM-backed entity resolvers silently return null** without their API key. Don't use an LLM — use the upstream API's own catalog endpoint, cached locally with TTL + alias table.
12. **Bundled catalog drifts from live API.** Always trust live; fall back to bundled only on network failure; verify alias targets exist in live before returning.
13. **Schema bounds in tool metadata get bypassed by guest** without bridge-layer validation. `safeParse` at the bridge before forwarding to `rawFn`.
14. **Fire-and-forget guest calls survive** after the tool returns. `cancelScope` in `finally` aborts in-flight calls + drains queued waiters.
15. **`invoke_endpoint` hangs forever on stalled upstream** without its own timeout wrapper. Apply the same 5 s + 6 s dual-timeout pattern as the execute bridge.
16. **Version claims in README drift from package.json.** Drop version-specific language; let changesets handle the actual bump.

## What's NOT worth transferring blindly

- `WRAPPED_TOKEN_KEYWORDS` — DeBank-specific concept
- The IQ Gateway integration (unless this project uses it)
- Specific zod response schemas (every API has different shape)
- The 7-row chain alias table (DefiLlama uses different chain identifiers and slug conventions)
- The cookbook recipe contents
- The bundled `src/enums/chains.ts` (DefiLlama's chain set differs from DeBank's)

## Reference materials in `/Users/aliusalaudeen/Documents/GitHub/debank-mcp`

When you need to understand a specific decision, read:

- `docs/adr/0001-no-host-side-response-filter.md` — why we deleted the v0.1 LLM response filter
- `docs/style/code-comments.md` — comment style conventions
- `README.md` — the target shape of the user-facing docs
- `src/mcp/execute/client.ts` — the bridge envelope contract + scope wiring
- `src/mcp/execute/sandbox.ts` — the three-layer timeout policy
- `src/mcp/legacy/tool-metadata.ts` — the lazy method-reference factory and metadata shape
- `src/lib/entity-resolver.ts` — the deterministic resolver pattern
- `.changeset/stainless-style-mcp-refactor.md` — the breaking-change summary

## Your first task

Read this project's current state — start with `package.json`, `README.md`, `src/index.ts`, and one representative service file. Then read the reference points in `debank-mcp` above. Produce a markdown document at `docs/superpowers/specs/<today>-stainless-style-refactor.md` containing:

1. A summary of the current architecture (in this project's terms)
2. The deltas from the target architecture
3. A phase-by-phase plan with file lists per phase
4. Any project-specific concerns the gotchas list doesn't cover

Don't touch any other files in phase 0. After the design doc is committed, I'll review it and approve phase 1.
