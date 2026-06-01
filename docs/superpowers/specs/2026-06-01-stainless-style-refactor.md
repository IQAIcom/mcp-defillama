# Stainless-style Code Mode refactor — design (Phase 0 audit)

- **Status:** Draft for review (Phase 0 deliverable)
- **Date:** 2026-06-01
- **Author:** Aliu Salaudeen
- **Reference implementation:** `/Users/aliusalaudeen/Documents/GitHub/debank-mcp` (`@iqai/mcp-debank@1.0.0`, PR #7 + cleanup PRs #8/#9)
- **Playbook:** `docs/playbooks/stainless-style-mcp-refactor.md`

This document audits the current `@iqai/defillama-mcp` server, maps the deltas to
the target "Stainless-style Code Mode" architecture, lays out a phase-by-phase
plan with per-phase file lists, and records the DefiLlama-specific concerns the
playbook's generic gotcha list does not cover. **No source files are changed in
Phase 0** — this spec is the only deliverable.

---

## 1. Current architecture (in this project's terms)

### 1.1 Shape

`@iqai/defillama-mcp` v0.0.1 is a **flat 19-tool FastMCP server**. Each tool is a
plain object (`{name, description, parameters: zod, execute}`) in a single array
exported from [src/tools/index.ts](../../../src/tools/index.ts); [src/index.ts](../../../src/index.ts)
loops over the array and calls `server.addTool(tool)`. Transport is stdio.

The 19 tools, grouped by the service that backs them:

| Service file | Tool(s) |
|---|---|
| `protocol.service.ts` | `defillama_get_chains`, `defillama_get_protocol_data`, `defillama_get_historical_chain_tvl` |
| `dex.service.ts` | `defillama_get_dexs_data` |
| `fees.service.ts` | `defillama_get_fees_and_revenue` |
| `stablecoin.service.ts` | `defillama_get_stablecoin`, `defillama_get_stablecoin_chains`, `defillama_get_stablecoin_charts`, `defillama_get_stablecoin_prices` |
| `price.service.ts` | `defillama_get_prices_current_coins`, `defillama_get_prices_first_coins`, `defillama_get_batch_historical`, `defillama_get_historical_prices_by_contract`, `defillama_get_percentage_coins`, `defillama_get_chart_coins` |
| `yield.service.ts` | `defillama_get_latest_pool_data`, `defillama_get_historical_pool_data` |
| `options.service.ts` | `defillama_get_options_data` |
| `blockchain.service.ts` | `defillama_get_blockchain_timestamp` |

### 1.2 Services return rendered markdown, not JSON

Every service method returns `Promise<string>` — a **markdown blob**, not raw
JSON. The pipeline (in [src/services/base.service.ts](../../../src/services/base.service.ts)):

1. Method fetches JSON via `fetchData<T>(url, ttl)` (axios; routes through IQ
   Gateway when `IQ_GATEWAY_URL`/`IQ_GATEWAY_KEY` are set, else direct).
2. Method hand-projects the JSON (slice top-N, pick essential fields).
3. Method calls `formatResponse(data, {title, currencyFields, numberFields})`,
   which renders markdown via `toMarkdown` (`src/lib/utils/markdown-formatter.ts`).
4. **Host-side LLM filter:** `formatResponse` counts tokens with a tiktoken
   encoder; if the result exceeds `config.maxTokens` (200k) AND a `currentQuery`
   is set AND an `aiModel` is wired, it calls `LLMDataFilter.filter()`
   (`src/utils/data-filter.ts`) — an LLM that writes a `jqts` query to compress
   the JSON against the user's query, with a "first-N items" fallback.

This is **exactly the v0.1 mechanism DeBank's ADR 0001 deleted** (the same
`formatResponse` / `setQuery` / `setAIModel` / `LLMDataFilter` / `_userQuery`
machinery, with the same mutable-singleton-state bug class — see §1.4).

### 1.3 Entity resolution is LLM-backed

[src/lib/resolvers/entity-resolver.ts](../../../src/lib/resolvers/entity-resolver.ts)
resolves human names (protocol / chain / stablecoin / bridge / option) to API
IDs. Resolution is done by an **LLM** (`base-resolver.ts` calls
`@ai-sdk/google` Gemini 2.5 Flash, optionally with cached content keyed via
`src/lib/cache/cache-manager.ts`) against **bundled static catalogs** in
`src/lib/enums/` (`chains.ts`, `protocols.ts`, `stablecoinIds.ts`,
`bridgeIds.ts`, `options.ts`). `resolveOption` is the only deterministic one
(exact/partial string match). This is gotcha #11: LLM resolvers silently return
null without an API key, and the bundled catalogs drift from the live API.

Resolution is invoked imperatively inside each tool's `execute` via
`autoResolveEntities(args)`, which mutates `args` in place before calling the
service.

### 1.4 Mutable singleton state via `_userQuery`

Every tool schema carries a hidden `_userQuery: z.string().optional()` param.
`setQueryFromArgs` / `extractQueryFromContext` broadcast that query to **all
eight service singletons** (`blockchainService.setQuery(...)`, etc.) before the
method runs, so the LLM filter has query context. The query lives as mutable
state on each `BaseService` instance — the precise leak-prone pattern ADR 0001
calls out (a query from call N can filter call N+1's response).

### 1.5 ADK dual-surface

[src/tools/index.ts](../../../src/tools/index.ts) also exports
`getDefillamaTools(): BaseTool[]`, wrapping each tool as an `@iqai/adk`
`createTool(...)` so the same definitions can be consumed by ADK agents. The ADK
path is where `extractQueryFromContext(context.userContent)` reads the user's
message to feed the filter. **DeBank had no ADK export; the reference dropped
`@iqai/adk` entirely.**

### 1.6 Infrastructure gaps vs. target

- **No tests** of any kind. No `vitest`, no `msw`, no `tests/` directory, no
  `pretest`/`test` scripts.
- **No build-time codegen.** No `scripts/`, no `prebuild`, no embedded docs
  index, no generated instructions.
- **No `isolated-vm`, no `minisearch`, no `tsx`, no `zod-to-json-schema`,
  no `cross-env`.**
- **No FastMCP `instructions`** passed to the server constructor.
- `package.json` has **no `engines.node`** and **no `pnpm.onlyBuiltDependencies`**;
  README recommends **Node 18**.
- `tsconfig.json` `exclude`s `**/*.test.ts` (fine), but there is no
  `tsconfig.scripts.json` and `start` does not pass `--no-node-snapshot`.
- `src/env.ts` uses bare `config()` from dotenv — **no `{quiet:true}`** and **no
  path resolution relative to `import.meta.url`** (gotchas #1, #2).
- Dependencies present that the target removes: `@ai-sdk/google`,
  `@google/generative-ai`, `@iqai/adk`, `@openrouter/ai-sdk-provider`, `ai`,
  `js-tiktoken`. (`jqts`, `zod`, `axios`, `dedent`, `fastmcp`, `winston` stay.)
- Untracked WIP present: `src/lib/cache/CACHING_IMPLEMENTATION.md`, `docs/`.

### 1.7 Multiple upstream base URLs

Unlike DeBank (one `config.baseUrl`), DefiLlama spreads endpoints across **four
hosts**, hard-coded in `BaseService`:

- `https://api.llama.fi` — protocols, TVL, dexs, fees, options, block timestamp
- `https://coins.llama.fi` — all price endpoints
- `https://stablecoins.llama.fi` — stablecoin endpoints
- `https://yields.llama.fi` — yield pool endpoints

DefiLlama is **public data with an optional API key** (`DEFILLAMA_API_KEY` →
`x-api-key`); there is no per-user auth, so the sandbox's "pre-authenticated
client" is really just "the shared API key + base URLs." Note also a chain-ID
convention split: `/v2/chains` returns **display names** ("Ethereum"), while the
coins API expects **lowercase slugs** in `chain:address` ("ethereum:0x…").

---

## 2. Deltas from the target architecture

| # | Dimension | Current | Target |
|---|---|---|---|
| D1 | Default tool surface | 19 flat `defillama_*` tools, always on | `execute` + `search_docs` only, always on |
| D2 | Extra tools | none | `defillama_resolve`, `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` behind `--tools=dynamic` / `DEFILLAMA_MCP_TOOLS=dynamic` |
| D3 | Service return type | `Promise<string>` (markdown) | `*Raw(args, options?: RequestOptions): Promise<T>` (JSON), threading `signal` + `timeout` |
| D4 | Response shaping | host-side LLM filter (`LLMDataFilter` + tiktoken) | agent-authored JS projection in the sandbox; `jq_filter` (`jqts`) on `invoke_endpoint` |
| D5 | Query plumbing | `_userQuery` param + `setQuery`/`setAIModel` mutable singleton state | deleted entirely; no per-call service state |
| D6 | Entity resolution | LLM (Gemini) over bundled static catalogs | deterministic: live catalog endpoint, cached w/ TTL, small alias table, bundled fallback |
| D7 | Sandbox | none | `isolated-vm` V8 isolate + `ExecutionScope` (budget/concurrency/timeouts) + `ExternalCopy` envelopes |
| D8 | Bridge validation | none (resolution mutates args; no schema check at call) | `safeParse` at the bridge before forwarding to `rawFn` |
| D9 | Docs index | none | MiniSearch index embedded at build time + cookbook recipes |
| D10 | Server instructions | none | `instructions.md` → `instructions.generated.ts`, passed to `FastMCP` |
| D11 | Tool metadata | inline in `tools/index.ts` | side-effect-free `mcp/legacy/tool-metadata.ts` (`lazyMethod` thunks) + `import` test |
| D12 | Build pipeline | `tsc` only | `prebuild` (`build:docs` + `build:instructions`) via `tsx`, then `tsc` |
| D13 | Tests | none | unit (`*.test.ts`) + `tests/integration/` spawning the built server |
| D14 | Runtime | Node 18, no flags | Node ≥22, `--no-node-snapshot`, `optionalDependencies` + lazy import for `isolated-vm` |
| D15 | ADK surface | `getDefillamaTools()` + `@iqai/adk` | removed (see C4 for the open decision) |
| D16 | env / dotenv | `config()` bare; LLM keys recognized | `config({quiet:true})` resolved from script dir; LLM keys removed; add `DEFILLAMA_MCP_TOOLS` |

### Files the reference contributes (copy near-verbatim)

Per the playbook, these come over with minimal change:
`src/mcp/execute/{scope,sandbox,tool}.ts`, `src/mcp/execute/client.ts` (adapt
only the resolver list + namespace + parse prefix), `src/mcp/search-docs/tool.ts`,
`scripts/build-docs-index.ts`, `scripts/build-instructions.ts`,
`tests/integration/{lazy-isolated-vm.test.ts (rename ids), no-isolated-vm.register.mjs,
no-isolated-vm.hooks.mjs}`.

### Files rebuilt fresh (DefiLlama-shape-specific)

`src/services/*.service.ts` (`*Raw`), `src/mcp/legacy/tool-metadata.ts`,
`src/mcp/legacy/response-schemas.ts`, `src/mcp/instructions/instructions.md`,
`src/mcp/search-docs/cookbook/*.md`, `src/lib/entity-resolver.ts`, `src/enums/`.

### Concept that does **not** transfer

`WRAPPED_TOKEN_KEYWORDS` / `resolveWrappedToken` (DeBank-specific), DeBank's
chain alias table, DeBank's response schemas, DeBank's cookbook contents, the
bundled DeBank `chains.ts`. DefiLlama's analogue is chain/protocol/stablecoin
slug resolution against its own catalog endpoints.

---

## 3. Phase-by-phase plan

Each phase is one PR; `pnpm build` + `pnpm test` green between phases. Phase 0 is
this document.

### Phase 0 — Audit + design doc ✅ (this PR)

- `docs/superpowers/specs/2026-06-01-stainless-style-refactor.md` *(new — this file)*

### Phase 1 — Service refactor to `*Raw()` JSON

Add a `RequestOptions = {signal?, timeout?}` type and convert each service
method to a `*Raw(args, options?)` returning typed JSON; thread `signal`/`timeout`
into axios. Delete `formatResponse`, `setQuery`, `setAIModel`, `currentQuery`,
`aiModel`, `dataFilter`, the tiktoken encoder, and the `LLMDataFilter` detour.
Drop the host-side filter and markdown rendering. Keep the IQ-Gateway-vs-direct
branch but add `signal`/`timeout` pass-through (mirror DeBank `base.service.ts`).

- `src/services/base.service.ts` *(rewrite: `fetchWithToolConfig`, `RequestOptions`, drop filter/markdown)*
- `src/services/{protocol,dex,fees,stablecoin,price,yield,options,blockchain}.service.ts` *(rewrite to `*Raw`)*
- `src/services/index.ts` *(drop `setAIModel` wiring + `openrouter` import → side-effect-free)*
- `src/types.ts` *(keep/extend response types)*
- `src/config.ts` *(replace `maxTokens` with cache TTLs)*
- **Delete:** `src/utils/data-filter.ts`, `src/lib/utils/markdown-formatter.ts`, `src/lib/integrations/openrouter.ts`
- **Tests:** `src/services/base.service.test.ts`, one `*.service.test.ts` per service (msw-mocked)
- *(Optional add ADR: `docs/adr/0001-no-host-side-response-filter.md`, DefiLlama-flavored)*

### Phase 2 — `tool-metadata.ts` + `response-schemas.ts`

Side-effect-free metadata with the `lazyMethod` factory; one entry per endpoint
(`{name, qualified, sandboxImpl, description, parameters, responseSchema,
exampleCall}`). Zod response schemas for `get_endpoint_schema`.

- `src/mcp/legacy/tool-metadata.ts` *(new — 19 entries; `defillama.<group>.<method>`)*
- `src/mcp/legacy/response-schemas.ts` *(new)*
- **Tests:** `src/mcp/legacy/tool-metadata.import.test.ts` (side-effect-freeness), `tool-metadata.test.ts`

### Phase 3 — Build-time codegen

- `scripts/build-docs-index.ts` *(copy)*
- `scripts/build-instructions.ts` *(copy)*
- `src/mcp/search-docs/embedded-index.ts` *(generated)*
- `src/mcp/instructions/instructions.generated.ts` *(generated)*
- `package.json` *(`build:docs`, `build:instructions`, `prebuild`, `pretest`)*
- Add devdeps: `tsx`, `zod-to-json-schema`, `minisearch`, `cross-env`
- *(`instructions.md` + cookbook content land in Phases 5/7; codegen wiring lands here)*

### Phase 4 — Sandbox + bridge

- `src/mcp/execute/scope.ts` *(copy; rename env vars to `DEFILLAMA_MCP_EXECUTE_*`)*
- `src/mcp/execute/sandbox.ts` *(copy)*
- `src/mcp/execute/tool.ts` *(copy)*
- `src/mcp/execute/client.ts` *(adapt: namespace `defillama`, `parseQualified` prefix, resolver list)*
- `package.json` *(`optionalDependencies.isolated-vm`, `pnpm.onlyBuiltDependencies`, `engines.node>=22`, `--no-node-snapshot`)*
- **Tests:** `execute/{scope,sandbox,client,tool}.test.ts`, `tests/integration/{execute.test.ts, lazy-isolated-vm.test.ts, no-isolated-vm.{register,hooks}.mjs, setup.ts}`

### Phase 5 — `search_docs` + cookbook

- `src/mcp/search-docs/tool.ts` *(copy)*
- `src/mcp/search-docs/cookbook/*.md` *(new — DefiLlama recipes; see §4)*
- **Tests:** `src/mcp/search-docs/tool.test.ts`, `tests/integration/search-docs.test.ts`

### Phase 6 — Dynamic tools

- `src/mcp/endpoints/tools.ts` *(new — `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` with `jq_filter` + dual-timeout)*
- `src/mcp/tools.ts` *(new — `defillama_resolve`)*
- **Tests:** `src/mcp/endpoints/tools.test.ts`, `src/mcp/tools.test.ts`

### Phase 7 — Server entry rewrite

- `src/index.ts` *(rewrite: register `execute` + `search_docs`; gate dynamic tools on `--tools=dynamic`/`DEFILLAMA_MCP_TOOLS=dynamic`; pass `instructions`; semver assert)*
- `src/env.ts` *(rewrite: `config({quiet:true})` from script dir; add `DEFILLAMA_MCP_TOOLS`; drop LLM keys)*
- `src/mcp/instructions/instructions.md` *(new — operational guide; see §4)*
- **Delete:** `src/tools/index.ts` (legacy 19-tool surface)
- **Tests:** `tests/integration/setup-smoke.test.ts`

### Phase 8 — Deterministic entity resolver

- `src/lib/entity-resolver.ts` *(new — `resolveChain`/`resolveProtocol`/`resolveStablecoin` over live catalog, cached TTL, alias table, bundled fallback)*
- `src/enums/` *(new — bundled DefiLlama catalogs as fallback)*
- **Delete:** `src/lib/resolvers/` (LLM resolvers, base-resolver, sanitizers, validators), `src/lib/enums/` (old static catalogs), `src/lib/cache/` (Gemini cached-content manager, if unused after this)
- **Tests:** `src/lib/entity-resolver.test.ts`

### Phase 9 — README + docs

- `README.md` *(rewrite to DeBank structure: Architecture diagram, Mermaid sequence, Safety limits, jq_filter, Error envelopes, Screenshots; Node 22 + absolute-path note)*
- `docs/style/code-comments.md` *(optional, mirror reference)*
- `.changeset/*.md` *(breaking-change summary; let changesets own the version bump)*

---

## 4. DefiLlama-specific concerns not covered by the playbook's gotchas

### C1. Four upstream base URLs, not one

DeBank's bridge assumes a single `config.baseUrl`. DefiLlama splits across
`api.llama.fi`, `coins.llama.fi`, `stablecoins.llama.fi`, `yields.llama.fi`.
Each `*Raw` method must keep its own host. The natural sandbox namespace mirrors
the **service grouping**, not the host: `defillama.protocol.*`, `defillama.dex.*`,
`defillama.fees.*`, `defillama.stablecoin.*`, `defillama.price.*`,
`defillama.yield.*`, `defillama.options.*`, `defillama.blockchain.*`. Decide the
group taxonomy in Phase 2 since `qualified` strings are load-bearing in
`client.ts`, `tool-metadata.ts`, and every cookbook/instruction reference.

### C2. Chain-ID convention split between endpoints

`/v2/chains` returns **display names** ("Ethereum", "BSC", "Arbitrum"); the
coins API expects **lowercase slugs** in `chain:address` ("ethereum:0x…"). A
single `resolveChain` cannot serve both. Either (a) expose two resolver outputs
(display name vs. coins slug) or (b) document the convention sharply in
`instructions.md` and let agents lowercase in the sandbox. The deterministic
resolver should be built from `/v2/chains` (live, cached) plus a small alias
table for "BSC"/"Binance"/"Matic"-style inputs — replacing the current Gemini
resolver and the bundled `chains.ts`.

### C3. Args that are themselves serialized payloads

Several endpoints take non-trivial argument encodings that today live in the
**tool layer**, not the service — these must move into `*Raw` so the sandbox
and `invoke_endpoint` produce identical results:

- `defillama_get_batch_historical`: the tool does
  `encodeURIComponent(JSON.stringify(coins))` before calling the service. That
  transform has to live inside `getBatchHistoricalRaw`.
- Price endpoints take `coins` as `chain:address[,chain:address]` strings, and
  `searchWidth`/`period` as duration-string-or-number unions. Schemas must
  preserve these unions (`z.union([z.string(), z.number()])`).
- `getBlockChainTimestamp` accepts Unix-seconds **or** ISO date and converts via
  `toUnixSeconds`. Keep that coercion in the `*Raw` method.

These are good candidates for explicit `responseSchema` + `exampleCall` care in
Phase 2.

### C4. ADK surface removal is a breaking API change for downstream consumers

The reference had no ADK export to lose. This project ships
`getDefillamaTools(): BaseTool[]` and depends on `@iqai/adk`. Removing it (D15)
drops a public, importable API that ADK agents may consume in-process — distinct
from removing the MCP tool surface. **Open decision (see question below):** drop
ADK entirely (clean, matches reference), or keep a thin `getDefillamaTools()`
that wraps the new `execute`/`search_docs` tools for ADK. Recommend dropping it
unless a known consumer exists; if kept, it must not reintroduce `_userQuery`
singleton state.

### C5. The LLM stack is larger here than in DeBank's v0.1

DeBank removed `LLMDataFilter` + `js-tiktoken` + `@openrouter/ai-sdk-provider`.
This project additionally pulls `@ai-sdk/google`, `@google/generative-ai`, `ai`,
and a **Gemini-cached-content** layer (`src/lib/cache/cache-manager.ts`,
`cacheNames`) feeding the LLM **resolvers** (not just the filter). Deletion spans
two subsystems — the filter (Phase 1) and the resolvers (Phase 8) — and the
`cache-manager` only survives if something other than Gemini cached content uses
it (audit at Phase 8; current evidence says it's resolver-only and can go). The
untracked `src/lib/cache/CACHING_IMPLEMENTATION.md` should be reconciled or
removed as part of that.

### C6. `config.maxTokens` and tiktoken are load-bearing only for the filter

`src/config.ts` is just `{maxTokens: 200000}` today, consumed solely by the
filter. Phase 1 repurposes `config.ts` for cache TTLs (DeBank style:
`baseUrl`/`*LifeTime`) — but DefiLlama has four hosts, so model TTLs per logical
group rather than per host, and there is no single `baseUrl`.

### C7. No per-user auth simplifies the scope story — but rate limits don't go away

The sandbox "pre-authenticated client" is just the shared optional API key.
There's no per-wallet secret to protect, so the budget/concurrency caps exist
mainly to protect **DefiLlama's public rate limits** (and the IQ Gateway quota)
from a fan-out script, not to protect a user credential. Keep the
budget/concurrency/timeout defaults from the reference; document the rationale in
`instructions.md` as rate-limit protection rather than auth protection.

### C8. Cookbook + instructions content must be written from scratch

DefiLlama recipes differ entirely from DeBank's portfolio/NFT/approval recipes.
Candidate recipes for `cookbook/*.md`: top-N protocols by TVL with chain
breakdown; DEX volume leaderboard for a chain; fees-vs-revenue join across
protocols; stablecoin market-cap by chain; token price history via
`chain:address`; block-at-timestamp → historical TVL; yield pool screen by
APY/TVL then drill into a pool's history. `instructions.md` must cover the
group taxonomy (C1), the chain-ID convention (C2), the `chain:address` price
format (C3), and the sandbox limits (C7).

### C9. Build ordering: codegen depends on metadata, server depends on codegen

`build-docs-index.ts` and `build-instructions.ts` import `tool-metadata.ts`
(must be side-effect-free per D11) and `instructions.md`. So Phase 2 (metadata)
must precede Phase 3 (codegen), and `instructions.md` content (Phase 7) needs a
placeholder during Phase 3 so `prebuild` doesn't break mid-sequence. Plan: land
a minimal `instructions.md` stub in Phase 3, flesh it out in Phase 7. Keep the
`tsx`-based scripts off the `tsconfig.json` `include` (they're build tooling, not
shipped `src`).

---

## Open question for review

**C4 — the ADK surface.** Do we drop `getDefillamaTools()` + `@iqai/adk`
entirely (matches the reference, removes the heaviest remaining dep), or retain a
thin ADK wrapper over the new two-tool surface? My recommendation is to drop it
unless there is a known in-process ADK consumer. This is the one delta where the
reference doesn't give us a precedent, so I'd like a decision before Phase 1
finalizes `services/index.ts` and `package.json`.
