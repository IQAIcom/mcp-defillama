# Stainless-style Code Mode refactor — design (Phase 0 audit)

- **Status:** Draft for review (Phase 0 deliverable)
- **Date:** 2026-06-01
- **Author:** Aliu Salaudeen
- **Reference implementation:** `/Users/aliusalaudeen/Documents/GitHub/debank-mcp` (`@iqai/mcp-debank@1.0.0`, PR #7 + cleanup PRs #8/#9)
- **Playbook:** `docs/playbooks/stainless-style-mcp-refactor.md` — **a guide, not a spec.** debank-mcp had a different starting architecture than this project, so we adopt its *principles* (Code Mode) and adapt the layout, namespacing, and phases to fit defillama-mcp's actual code.

This document audits the current `@iqai/defillama-mcp` server, maps the deltas to
a **DefiLlama-native** Code Mode architecture, lays out a phase-by-phase plan with
per-phase file lists, and records the DefiLlama-specific concerns. **No source
files are changed in Phase 0** — this spec is the only deliverable.

## Decisions locked in Phase 0 review

These resolve the would-be open questions and shape §2–§4:

- **D-1 — Adapt, don't mirror.** Keep Code Mode principles (`execute` +
  `search_docs` default surface, opt-in dynamic tools, `isolated-vm` sandbox with
  an `ExecutionScope`, deterministic resolver, JSON-returning `*Raw()` services,
  bridge-layer validation, `ExternalCopy` envelopes). Design our own directory
  layout/namespacing/phase sequence rather than copying debank's tree verbatim.
- **D-2 — Keep the IQ Gateway integration.** The `IQ_GATEWAY_URL`/`IQ_GATEWAY_KEY`
  caching+proxy branch in the base service stays (debank kept it too).
- **D-3 — Keep the ADK surface.** `getDefillamaTools()` + `@iqai/adk` stays, but
  is **adapted** to wrap the new tool surface (execute/search_docs/dynamic) and
  stripped of the `_userQuery`/`setQuery` plumbing. This is the one place we
  intentionally diverge from the reference, which has no ADK export.
- **D-4 — Keep the multi-base-URL service split.** Services stay grouped by
  domain, each owning its own `*.llama.fi` host; there is no single `baseUrl`.

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
(exact/partial string match). LLM resolvers silently return null without an API
key, and the bundled catalogs drift from the live API.

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
`createTool(...)` so the same definitions can be consumed by ADK agents
in-process. The ADK path is where `extractQueryFromContext(context.userContent)`
reads the user's message to feed the filter. **Per D-3 this surface stays** —
re-pointed at the new tools and stripped of the query plumbing.

### 1.6 Infrastructure gaps vs. target

- **No tests** of any kind. No `vitest`, no `msw`, no `tests/` directory, no
  `pretest`/`test` scripts.
- **No build-time codegen.** No `scripts/`, no `prebuild`, no embedded docs
  index, no generated instructions.
- **No `isolated-vm`, no `minisearch`, no `tsx`, no `cross-env`.** (Schema→JSON
  uses Zod 4's built-in `z.toJSONSchema`, already available via `zod@^4.1.11` —
  **not** the `zod-to-json-schema` package, which peers on Zod 3 and only appears
  as a transitive in the lockfile.)
- **No FastMCP `instructions`** passed to the server constructor.
- `package.json` has **no `engines.node`** and **no `pnpm.onlyBuiltDependencies`**;
  README recommends **Node 18**.
- `tsconfig.json` `exclude`s `**/*.test.ts` (fine), but there is no
  `tsconfig.scripts.json` and `start` does not pass `--no-node-snapshot`.
- `src/env.ts` uses bare `config()` from dotenv — **no `{quiet:true}`** and **no
  path resolution relative to `import.meta.url`** (gotchas #1, #2).
- Dependencies the target **drops**, staged by when their last consumer is
  deleted: `@openrouter/ai-sdk-provider` + `js-tiktoken` in **Phase 1** (filter),
  `@ai-sdk/google` + `@google/generative-ai` + `ai` in **Phase 3** (Gemini
  resolver/cache — `ai` lingers because the filter *and* the resolver both import
  it). Env keys follow the same staging: `OPENROUTER_API_KEY`/`LLM_MODEL` (P1),
  `GOOGLE_GENERATIVE_AI_API_KEY` (P3). Dependencies that **stay**: `@iqai/adk`
  (D-3), `jqts`, `zod`, `axios`, `dedent` (reused by `execute/client.ts`),
  `fastmcp`, `winston`.
- Untracked WIP present: `src/lib/cache/CACHING_IMPLEMENTATION.md`, `docs/`.

### 1.7 Multiple upstream base URLs (kept — D-4)

Unlike DeBank (one `config.baseUrl`), DefiLlama spreads endpoints across **four
hosts**, hard-coded in `BaseService`:

- `https://api.llama.fi` — protocols, TVL, dexs, fees, options (`protocol`, `dex`, `fees`, `options` services)
- `https://coins.llama.fi` — all price endpoints **and the block-at-timestamp endpoint** (`price` + `blockchain` services; the `blockchain` group's host is coins.llama.fi, not api.llama.fi — verified at [blockchain.service.ts:28](../../../src/services/blockchain.service.ts))
- `https://stablecoins.llama.fi` — stablecoin endpoints (`stablecoin` service)
- `https://yields.llama.fi` — yield pool endpoints (`yield` service)

DefiLlama is **public data with an optional API key** (`DEFILLAMA_API_KEY` →
`x-api-key`); there is no per-user auth, so the sandbox's "pre-authenticated
client" is really just "the shared API key + base URLs." Note also a chain-ID
convention split: `/v2/chains` returns **display names** ("Ethereum"), while the
coins API expects **lowercase slugs** in `chain:address` ("ethereum:0x…").

---

## 2. Deltas to the DefiLlama-native target

### 2.1 Target directory layout

Adapted from the playbook's tree (D-1). Differences from debank are flagged.

```
src/
├── index.ts                  # FastMCP: execute + search_docs default; dynamic gated by flag/env
├── env.ts                    # config({quiet:true}) from script dir; + DEFILLAMA_MCP_TOOLS; LLM keys gone
├── config.ts                 # per-group cache TTLs — NO single baseUrl (D-4: hosts live in services)
├── adk/
│   └── index.ts              # getDefillamaTools() — thin ADK adapter over the new tools (D-3, NEW location)
├── services/                 # 8 domain services; each owns its *.llama.fi host (D-4); *Raw() → JSON
│   ├── base.service.ts       # fetch/post + IQ Gateway branch (D-2) + RequestOptions{signal,timeout}
│   └── {protocol,dex,fees,stablecoin,price,yield,options,blockchain}.service.ts
├── lib/
│   ├── entity-resolver.ts    # deterministic resolveChain/Protocol/Stablecoin over live catalog + TTL cache
│   └── utils/                # logger, error-handler
├── mcp/
│   ├── tools.ts              # defillama_resolve (dynamic mode)
│   ├── execute/              # scope.ts, sandbox.ts, client.ts, tool.ts
│   ├── search-docs/          # tool.ts, embedded-index.ts (generated), cookbook/*.md
│   ├── endpoints/            # list_endpoints, get_endpoint_schema, invoke_endpoint (jq_filter)
│   ├── instructions/         # instructions.md + instructions.generated.ts (generated)
│   └── catalog/              # tool-metadata.ts (side-effect-free) + response-schemas.ts
│                             #   ^ debank named this "legacy"; we have no legacy surface, so "catalog"
└── enums/                    # bundled DefiLlama catalogs (fallback for the resolver)

scripts/
├── build-docs-index.ts       # imports mcp/catalog/tool-metadata.ts (path adapted from debank's "legacy")
└── build-instructions.ts
tests/integration/            # spawn the built server end-to-end
```

Sandbox namespace: **`defillama.<group>.<method>`**, group ∈ {protocol, dex, fees,
stablecoin, price, yield, options, blockchain} — mirrors the service split (D-4),
not the host.

Resolvers exposed in-sandbox must **encode the chain-ID convention split** (C2) —
a single `resolveChain` can't serve both the display-name endpoints
(api.llama.fi) and the coins `chain:address` slugs (coins.llama.fi). The
interface returns both forms from one lookup:

```
defillama.resolveChain(input)   → { name: "Ethereum", slug: "ethereum" } | null
defillama.resolveProtocol(input)→ "lido" | null            // protocol slug
defillama.resolveStablecoin(in) → "1" | null               // numeric stablecoin id
```

The agent picks `.name` for `protocol`/`dex`/`fees`/`options`/`blockchain` calls
and `.slug` for `price` (`chain:address`) calls. (Equivalent alternative:
separate `resolveChainName` / `resolveCoinChainSlug` functions — same outcome,
two names instead of a field pick. The `{name, slug}` return is one catalog
lookup, so it's preferred.) The same shape backs the `defillama_resolve` dynamic
tool.

### 2.2 Delta table

| # | Dimension | Current | Target |
|---|---|---|---|
| D1 | Default tool surface | 19 flat `defillama_*` tools, always on | `execute` + `search_docs` only, always on |
| D2 | Extra tools | none | `defillama_resolve`, `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` behind `--tools=dynamic` / `DEFILLAMA_MCP_TOOLS=dynamic` |
| D3 | Service return type | `Promise<string>` (markdown) | `*Raw(args, options?: RequestOptions): Promise<T>` (JSON), threading `signal` + `timeout` |
| D4 | Response shaping | host-side LLM filter (`LLMDataFilter` + tiktoken) | agent-authored JS projection in the sandbox; `jq_filter` (`jqts`) on `invoke_endpoint` |
| D5 | Query plumbing | `_userQuery` param + `setQuery`/`setAIModel` mutable singleton state | deleted entirely; no per-call service state |
| D6 | Entity resolution | LLM (Gemini) over bundled static catalogs | deterministic: live catalog endpoint, cached w/ TTL, small alias table, bundled fallback; `resolveChain` returns `{name, slug}` to cover both host conventions (C2) |
| D7 | Sandbox | none | `isolated-vm` V8 isolate + `ExecutionScope` (budget/concurrency/timeouts) + `ExternalCopy` envelopes |
| D8 | Bridge validation | none (resolution mutates args; no schema check at call) | `safeParse` at the bridge before forwarding to `rawFn` |
| D9 | Docs index | none | MiniSearch index embedded at build time + cookbook recipes |
| D10 | Server instructions | none | `instructions.md` → `instructions.generated.ts`, passed to `FastMCP` |
| D11 | Endpoint metadata | inline in `tools/index.ts` | side-effect-free `mcp/catalog/tool-metadata.ts` (`lazyMethod` thunks) + `import` test |
| D12 | Build pipeline | `tsc` only | `prebuild` (`build:docs` + `build:instructions`) via `tsx`, then `tsc` |
| D13 | Tests | none | unit (`*.test.ts`) + `tests/integration/` spawning the built server |
| D14 | Runtime | Node 18, no flags | Node ≥22, `--no-node-snapshot`, `optionalDependencies` + lazy import for `isolated-vm` |
| D15 | ADK surface | `getDefillamaTools()` over 19 tools, w/ `_userQuery` context plumbing | **kept (D-3)**, moved to `src/adk/`, re-pointed at the new tools, query plumbing removed |
| D16 | IQ Gateway | base-service branch on `IQ_GATEWAY_*` | **kept (D-2)**, now also threads `signal`/`timeout` |
| D17 | Base URL(s) | 4 hosts hard-coded in `BaseService` | **kept (D-4)**: each service owns its host; no single `baseUrl` |
| D18 | env / dotenv | `config()` bare; LLM keys recognized | `config({quiet:true})` resolved from script dir; LLM keys removed; add `DEFILLAMA_MCP_TOOLS` |

### 2.3 Provenance of files

**Copy near-verbatim from debank** (adapt the noted bits only):
`src/mcp/execute/{scope,sandbox,tool}.ts` (rename scope env vars to
`DEFILLAMA_MCP_EXECUTE_*`); `src/mcp/execute/client.ts` (namespace `defillama`,
`parseQualified` prefix, resolver list, import path `catalog` not `legacy`);
`src/mcp/search-docs/tool.ts`; `scripts/build-docs-index.ts` +
`scripts/build-instructions.ts` (import path `catalog`);
`tests/integration/{lazy-isolated-vm.test.ts (rename ids), no-isolated-vm.register.mjs,
no-isolated-vm.hooks.mjs}`.

**Rebuild fresh (DefiLlama-shape-specific):** `src/services/*.service.ts`
(`*Raw`), `src/mcp/catalog/tool-metadata.ts`, `src/mcp/catalog/response-schemas.ts`,
`src/mcp/instructions/instructions.md`, `src/mcp/search-docs/cookbook/*.md`,
`src/lib/entity-resolver.ts`, `src/enums/`, `src/adk/index.ts`.

**Concept that does not transfer:** `WRAPPED_TOKEN_KEYWORDS` /
`resolveWrappedToken` (DeBank-specific), DeBank's chain alias table, DeBank's
response schemas, DeBank's cookbook contents, the bundled DeBank `chains.ts`.

---

## 3. Phase-by-phase plan

Each phase is one PR; `pnpm build` + `pnpm test` green between phases. Phase 0 is
this document.

### Phase 0 — Audit + design doc ✅ (this PR)

- `docs/superpowers/specs/2026-06-01-stainless-style-refactor.md` *(new — this file)*

### Phase 1 — Service refactor to `*Raw()` JSON (+ test tooling)

Add `RequestOptions = {signal?, timeout?}` and convert each method to
`*Raw(args, options?)` returning typed JSON; thread `signal`/`timeout` into axios.
Delete `formatResponse`, `setQuery`, `setAIModel`, `currentQuery`, `aiModel`,
`dataFilter`, the tiktoken encoder, and the `LLMDataFilter` detour. Keep the IQ
Gateway branch (D-2) and the four hosts (D-4); add `signal`/`timeout`
pass-through. `@iqai/adk` stays in `package.json` (D-3).

**Keep this phase buildable (review finding 1).** Deleting `formatResponse`
breaks the legacy tools, which call markdown-returning methods like `getChains()`
([src/tools/index.ts:162](../../../src/tools/index.ts)). So in the **same phase**,
rewire the legacy 19-tool surface onto `*Raw()`: each tool's `execute` calls the
matching `*Raw()` and returns `JSON.stringify(result)`; remove the `_userQuery`
schema field, `setQueryFromArgs`, `extractQueryFromContext`, and the
`setAIModel` broadcast. `autoResolveEntities` keeps calling the **existing LLM
resolvers** (`src/lib/resolvers/`) — those aren't touched until Phase 3 — so the
legacy surface and the ADK `getDefillamaTools()` wrapper stay functional and the
build/tests stay green. (The legacy surface and ADK move/delete happen in Phase
8.) Test tooling is added here, not later (review finding 5).

- `src/services/base.service.ts` *(rewrite: `RequestOptions`, IQ-Gateway+direct w/ signal/timeout, drop filter/markdown)*
- `src/services/{protocol,dex,fees,stablecoin,price,yield,options,blockchain}.service.ts` *(rewrite to `*Raw`)*
- `src/services/index.ts` *(drop `setAIModel` wiring + `openrouter` import → side-effect-free)*
- `src/tools/index.ts` *(rewire each tool onto `*Raw()` → `JSON.stringify`; strip `_userQuery`/`setQuery`/context plumbing; keep `autoResolveEntities` on the existing LLM resolvers for now)*
- `src/types.ts` *(keep/extend response types)*
- `src/config.ts` *(replace `maxTokens` with per-group cache TTLs; no `baseUrl`)*
- `src/env.ts` *(remove the **filter** env keys `OPENROUTER_API_KEY` + `LLM_MODEL` from the zod schema; the dotenv-mechanics rewrite + `DEFILLAMA_MCP_TOOLS` stay for Phase 8)*
- `package.json` *(add `test`/`pretest` scripts; devdeps `vitest`, `@vitest/coverage-v8`, `msw`, `cross-env`; `pretest: tsc`. **Remove now-unused deps `@openrouter/ai-sdk-provider` + `js-tiktoken`** — both used only by the deleted filter/openrouter modules. `ai`, `@ai-sdk/google`, `@google/generative-ai` stay until Phase 3 (still used by the Gemini resolver); `dedent` stays for `execute/client.ts`.)*
- **Delete:** `src/utils/data-filter.ts`, `src/lib/utils/markdown-formatter.ts`, `src/lib/integrations/openrouter.ts`
- **Tests:** `src/services/base.service.test.ts` + one `*.service.test.ts` per service (msw-mocked)
- *(Add ADR: `docs/adr/0001-no-host-side-response-filter.md`, DefiLlama-flavored)*

### Phase 2 — `catalog/tool-metadata.ts` + `response-schemas.ts`

Side-effect-free metadata with the `lazyMethod` factory; one entry per endpoint
(`{name, qualified, sandboxImpl, description, parameters, responseSchema,
exampleCall}`), `qualified = defillama.<group>.<method>`.

- `src/mcp/catalog/tool-metadata.ts` *(new — 19 entries)*
- `src/mcp/catalog/response-schemas.ts` *(new)*
- **Tests:** `src/mcp/catalog/tool-metadata.import.test.ts` (side-effect-freeness), `tool-metadata.test.ts`

### Phase 3 — Deterministic entity resolver

**Moved ahead of the sandbox (review finding 2):** the bridge (`client.ts`,
Phase 5) and `defillama_resolve` (Phase 7) both install/expose the resolver, so
it must exist first. Build it on the live catalog endpoints (`/v2/chains`,
`/protocols`, stablecoins list) reached through the Phase-1 `*Raw()` methods,
cached with TTL, plus a small alias table and bundled fallback. `resolveChain`
returns `{name, slug}` to cover both host conventions (C2). In the same phase,
rewire `src/tools/index.ts`'s `autoResolveEntities` onto the new resolver — once
that's the only consumer of the old LLM resolvers, delete them. ADK and the
legacy surface stay green throughout.

**Mechanical-rewire hazard (review finding 2):** the legacy code assigns the
resolver result straight to `args.chain` ([src/tools/index.ts:87](../../../src/tools/index.ts)),
which is then interpolated into service URLs. Since `resolveChain` now returns an
**object**, the rewire must assign **`resolved.name`** (the display-name form the
legacy URLs already use), not the object — `args.chain = resolved.name`.
Protocols/stablecoins still resolve to scalars, so those assignments are
unchanged. Bridge/option auto-resolution is dropped (no current tool takes a
`bridge` or `option` arg; the new resolver doesn't provide them).

- `src/lib/entity-resolver.ts` *(new — `resolveChain` → `{name, slug}`, `resolveProtocol`, `resolveStablecoin`; live catalog + TTL cache + alias table + bundled fallback)*
- `src/enums/` *(new — bundled DefiLlama catalogs as fallback)*
- `src/tools/index.ts` *(rewire `autoResolveEntities` onto the new resolver; `args.chain = resolved.name`; drop bridge/option resolution; **update tool descriptions that claim resolution happens "via AI"** — [tools/index.ts:171,177,389](../../../src/tools/index.ts) — to say deterministic catalog resolution, since this surface lives until Phase 8)*
- `src/env.ts` *(remove the **resolver** env key `GOOGLE_GENERATIVE_AI_API_KEY` from the zod schema)*
- `package.json` *(**remove now-unused deps `@ai-sdk/google`, `@google/generative-ai`, `ai`** — last users were the Gemini resolver + cache, both deleted here)*
- **Delete:** `src/lib/resolvers/` (LLM resolvers, base-resolver, sanitizers, validators), `src/lib/enums/` (old static catalogs), `src/lib/cache/` (Gemini cached-content manager + `instructions.ts` — confirm unused first)
- **Tests:** `src/lib/entity-resolver.test.ts`

### Phase 4 — Build-time codegen

- `scripts/build-docs-index.ts`, `scripts/build-instructions.ts` *(copy; import `catalog`)*
- `src/mcp/search-docs/embedded-index.ts` *(generated)*
- `src/mcp/instructions/instructions.generated.ts` *(generated)*
- `src/mcp/instructions/instructions.md` *(stub here; fleshed out in Phase 8 — see C9)*
- `package.json` *(`build:docs`, `build:instructions`, `prebuild`; `pretest` now runs `prebuild`+`tsc`; devdeps `tsx`, `minisearch`. **No `zod-to-json-schema`** — the copied scripts call Zod 4's built-in `z.toJSONSchema(...)` (review finding 1); debank does the same despite its vestigial devDep listing.)*

### Phase 5 — Sandbox + bridge

- `src/mcp/execute/scope.ts` *(copy; env vars → `DEFILLAMA_MCP_EXECUTE_*`)*
- `src/mcp/execute/sandbox.ts` *(copy)*
- `src/mcp/execute/tool.ts` *(copy)*
- `src/mcp/execute/client.ts` *(adapt: `defillama` namespace, `parseQualified` prefix, resolver list from Phase 3, `catalog` import)*
- `package.json` *(`optionalDependencies.isolated-vm`, `pnpm.onlyBuiltDependencies`, `engines.node>=22`, `--no-node-snapshot` on `test`/`start`)*
- **Tests:** `execute/{scope,sandbox,client,tool}.test.ts`, `tests/integration/{execute.test.ts, lazy-isolated-vm.test.ts, no-isolated-vm.{register,hooks}.mjs, setup.ts}`

### Phase 6 — `search_docs` + cookbook

- `src/mcp/search-docs/tool.ts` *(copy)*
- `src/mcp/search-docs/cookbook/*.md` *(new — DefiLlama recipes; see C8)*
- **Tests:** `src/mcp/search-docs/tool.test.ts`, `tests/integration/search-docs.test.ts`

### Phase 7 — Dynamic tools

- `src/mcp/endpoints/tools.ts` *(new — `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` with `jq_filter` + dual-timeout)*
- `src/mcp/tools.ts` *(new — `defillama_resolve`, backed by the Phase-3 resolver)*
- **Tests:** `src/mcp/endpoints/tools.test.ts`, `src/mcp/tools.test.ts`

### Phase 8 — Server entry + ADK adapter rewrite

- `src/index.ts` *(rewrite: register `execute` + `search_docs`; gate dynamic on `--tools=dynamic`/`DEFILLAMA_MCP_TOOLS=dynamic`; pass `instructions`; semver assert)*
- `src/env.ts` *(dotenv mechanics: `config({quiet:true})` resolved from script dir; add `DEFILLAMA_MCP_TOOLS`. LLM keys already removed in Phases 1 & 3.)*
- `src/adk/index.ts` *(new — `getDefillamaTools()` adapter over execute/search_docs/dynamic; no `_userQuery`/context plumbing) — D-3*
- `src/mcp/instructions/instructions.md` *(flesh out — operational guide; see C8)*
- **Delete:** `src/tools/index.ts` (legacy 19-tool surface + old ADK wrapper)
- **Tests:** `tests/integration/setup-smoke.test.ts`, `src/adk/index.test.ts`

### Phase 9 — README + docs

- `README.md` *(rewrite: Architecture diagram, Mermaid sequence, Safety limits, jq_filter, Error envelopes, Screenshots, ADK usage section, Node 22 + absolute-path note)*
- `docs/style/code-comments.md` *(optional, mirror reference)*
- `.changeset/*.md` *(breaking-change summary; let changesets own the version bump)*

---

## 4. DefiLlama-specific concerns

### C1. Four upstream base URLs (design decision — D-4)

Services stay grouped by domain, each owning its `*.llama.fi` host; `config.ts`
holds per-group cache TTLs but **no single `baseUrl`**. The sandbox namespace
mirrors the service grouping (`defillama.protocol.*`, `defillama.price.*`, …),
not the host. Lock the group taxonomy in Phase 2 — `qualified` strings are
load-bearing in `client.ts`, `tool-metadata.ts`, and every cookbook/instruction
reference.

### C2. Chain-ID convention split between endpoints

`/v2/chains` returns **display names** ("Ethereum", "BSC"); the coins API expects
**lowercase slugs** in `chain:address` ("ethereum:0x…"). A single resolver that
returns one string can't serve both, so (per review finding 3) the Phase-3
resolver returns **both forms from one lookup**:
`resolveChain(input) → { name: "Ethereum", slug: "ethereum" } | null`. The agent
uses `.name` for the api.llama.fi groups (`protocol`/`dex`/`fees`/`options`) and
the `blockchain` group, and `.slug` for the coins-API `price` group's
`chain:address` arguments. Build it from `/v2/chains` (live, cached) + a small
alias table for "BSC"/"Binance"/"Matic" inputs, and **document the convention in
`instructions.md`**. This replaces the Gemini resolver and the bundled
`chains.ts`. (`resolveProtocol` and `resolveStablecoin` still return a single
slug/id each.)

### C3. Args that are themselves serialized payloads

Several endpoints take non-trivial encodings that today live in the **tool
layer**, not the service — these must move into `*Raw` so the sandbox and
`invoke_endpoint` produce identical results:

- `defillama_get_batch_historical`: the tool does
  `encodeURIComponent(JSON.stringify(coins))` before calling the service — move
  that into `getBatchHistoricalRaw`.
- Price endpoints take `coins` as `chain:address[,chain:address]` strings and
  `searchWidth`/`period` as duration-string-or-number unions; schemas must
  preserve the unions (`z.union([z.string(), z.number()])`).
- `getBlockChainTimestamp` accepts Unix-seconds **or** ISO date and converts via
  `toUnixSeconds` — keep that coercion inside the `*Raw` method.

Give these explicit `responseSchema` + `exampleCall` care in Phase 2.

### C4. ADK surface is kept and adapted (D-3)

We retain `getDefillamaTools()` + `@iqai/adk`, but it moves to `src/adk/` and is
re-pointed at the new tool surface (`execute`, `search_docs`, and optionally the
dynamic tools) instead of the deleted 19 tools. The `_userQuery` /
`extractQueryFromContext` / `setQuery` broadcast plumbing is removed — the ADK
adapter must be a thin pass-through that does **not** reintroduce per-call
singleton state. `@iqai/adk` does not pull in the `ai`/`@ai-sdk` packages, so
dropping those (C5) is unaffected.

### C5. The LLM stack spans two subsystems

debank removed `LLMDataFilter` + `js-tiktoken` + `@openrouter/ai-sdk-provider`.
This project additionally pulls `@ai-sdk/google`, `@google/generative-ai`, `ai`,
and a **Gemini-cached-content** layer (`src/lib/cache/cache-manager.ts`,
`cacheNames`) feeding the LLM **resolvers** (not just the filter). Deletion spans
the filter (Phase 1) and the resolvers (Phase 3); `cache-manager` only survives
if something other than Gemini cached content uses it (audit at Phase 3 — current
evidence says resolver-only, so it goes). Reconcile/remove the untracked
`src/lib/cache/CACHING_IMPLEMENTATION.md` then.

### C6. `config.ts` repurpose

`config.ts` is just `{maxTokens: 200000}` today, consumed solely by the filter.
Phase 1 repurposes it for cache TTLs — but per D-4 there's no single `baseUrl`;
model TTLs per logical group, and let each service hold its own host constants.

### C7. No per-user auth — caps protect rate limits, not a credential

The sandbox "pre-authenticated client" is just the shared optional API key.
There's no per-wallet secret to protect, so the budget/concurrency/timeout caps
exist mainly to protect **DefiLlama's public rate limits** (and the IQ Gateway
quota under D-2) from a fan-out script. Keep the reference defaults; document the
rationale in `instructions.md` as rate-limit protection.

### C8. Cookbook + instructions written from scratch

DefiLlama recipes differ entirely from DeBank's. Candidate `cookbook/*.md`:
top-N protocols by TVL with chain breakdown; DEX volume leaderboard for a chain;
fees-vs-revenue join across protocols; stablecoin market-cap by chain; token
price history via `chain:address`; block-at-timestamp → historical TVL; yield
pool screen by APY/TVL then drill into a pool's history. `instructions.md` must
cover the group taxonomy (C1), the chain-ID convention (C2), the `chain:address`
price format (C3), the IQ Gateway behavior (D-2), and the sandbox limits (C7).

### C9. Build ordering: codegen depends on metadata; server depends on codegen

`build-docs-index.ts` / `build-instructions.ts` import `catalog/tool-metadata.ts`
(must be side-effect-free per D11) and `instructions.md`. So Phase 2 (metadata)
precedes Phase 4 (codegen), and a minimal `instructions.md` **stub** lands in
Phase 4 so `prebuild` doesn't break mid-sequence; it's fleshed out in Phase 8.
Keep the `tsx` build scripts off the `tsconfig.json` `include`.
