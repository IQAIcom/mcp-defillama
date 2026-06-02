# Stainless-style Code Mode Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `@iqai/defillama-mcp` from a flat 19-tool markdown/LLM-filter server into a Stainless-style Code Mode server — `execute` + `search_docs` by default, four opt-in dynamic tools, an `isolated-vm` sandbox over JSON-returning `*Raw()` services, and a deterministic entity resolver — shipped as **one PR**.

**Architecture:** Services become pure transport (`*Raw(args, options?) → full upstream JSON`). A side-effect-free catalog (`tool-metadata.ts`) describes every upstream endpoint. The `execute` tool runs agent-authored JS in an `isolated-vm` isolate against a pre-wired `defillama.*` client, with per-invocation budget/concurrency/timeout caps and bridge-layer zod validation; only the agent's projected return crosses the V8 boundary. `search_docs` is a build-time MiniSearch index. Dynamic tools (`defillama_resolve`, `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint`) are gated behind `--tools=dynamic`. The IQ Gateway branch, the four-host service split, and the ADK `getDefillamaTools()` export are kept.

**Tech Stack:** TypeScript (NodeNext, ES2022), Node ≥22, `fastmcp`, `isolated-vm` (optional dep, lazy-imported), `minisearch`, `jqts`, `zod@4`, `axios`, `vitest` + `msw`, `tsx` (build scripts), Biome.

**Reference implementation:** debank-mcp — GitHub [`IQAIcom/mcp-debank`](https://github.com/IQAIcom/mcp-debank) (npm `@iqai/mcp-debank`). Read the named files there when a task says "copy/adapt from debank"; on the dev machine it sits as a sibling directory of this repo.

**Design doc (contract):** `docs/superpowers/specs/2026-06-01-stainless-style-refactor.md`. Decisions D-1…D-5 and concerns C1…C9 are binding; this plan implements them.

---

## How to use this plan

- **TDD loop per task:** write the failing test → run it red → minimal implementation → run it green → commit. Steps are bite-sized (2–5 min).
- **Branch:** all work lands on one branch (e.g. `refactor/stainless-style-code-mode`) cut from `main` *after* the design-doc PR merges. Phases are commit-blocks, not separate PRs (D-5). Keep `pnpm build` + `pnpm test` green at every phase boundary.
- **Density decision (deliberate):** the 23 `*Raw()` conversions are mechanical and near-identical, so Phase 1 gives a **conversion recipe + complete endpoint reference table (§ Reference) + 3 fully-worked examples**, not 23 verbatim bodies (which would be more error-prone). The `execute/`, `search-docs/tool.ts`, build scripts, and integration harness are **copied from debank** with exact, enumerated adaptations. Everything project-specific (resolver, dynamic tools, server entry, ADK adapter, schemas) has full code or full copy-from instructions. No task is a vague placeholder.
- **Commit message convention:** Conventional Commits; end every commit body with the `Co-Authored-By` trailer the repo uses.

---

## File structure (target)

```
src/
├── index.ts                  # FastMCP: execute + search_docs default; dynamic gated [Phase 8]
├── env.ts                    # zod env; LLM keys removed [P1/P3]; dotenv mechanics [P8]
├── config.ts                 # per-group cache TTLs, no baseUrl [P1]
├── types.ts                  # response types (extended) [P1]
├── adk/index.ts              # getDefillamaTools() over the new tools [P8]
├── services/
│   ├── base.service.ts       # RequestOptions, IQ-Gateway+direct w/ signal/timeout [P1]
│   └── {protocol,dex,fees,stablecoin,price,yield,options,blockchain}.service.ts  # *Raw() [P1]
├── lib/
│   ├── entity-resolver.ts    # deterministic resolveChain/{name,slug}/Protocol/Stablecoin [P3]
│   └── utils/                # logger, error-handler (existing; keep)
├── mcp/
│   ├── tools.ts              # defillama_resolve [P7]
│   ├── execute/{scope,sandbox,tool,client}.ts   # [P5]
│   ├── search-docs/{tool.ts, embedded-index.ts(gen), cookbook/*.md}  # [P4/P6]
│   ├── endpoints/tools.ts    # list_endpoints, get_endpoint_schema, invoke_endpoint [P7]
│   ├── instructions/{instructions.md, instructions.generated.ts(gen)}  # [P4 stub / P8 full]
│   └── catalog/{tool-metadata.ts, response-schemas.ts}  # side-effect-free [P2]
└── enums/                    # bundled DefiLlama fallback catalogs [P3]
scripts/{build-docs-index.ts, build-instructions.ts}   # [P4]
tests/integration/           # spawn built server [P5+]
docs/adr/0001-no-host-side-response-filter.md          # [P1]
```

Deleted by end of PR: `src/tools/index.ts` [P8], `src/utils/data-filter.ts` [P1], `src/lib/utils/markdown-formatter.ts` [P1], `src/lib/integrations/openrouter.ts` [P1], `src/lib/resolvers/` [P3], `src/lib/enums/` [P3], `src/lib/cache/` [P3].

---

## Reference — the 23 upstream endpoints

Single source of truth for Phases 1 (methods) and 2 (catalog). `host` column: `api`=api.llama.fi, `coins`=coins.llama.fi, `stable`=stablecoins.llama.fi, `yields`=yields.llama.fi. "Upstream args" become the `*Raw()` / catalog `parameters`. "Client-only (moved to legacy tool)" are dropped from `*Raw()`.

| qualified | host | URL template | Upstream args | Client-only (→ legacy tool) | Response type |
|---|---|---|---|---|---|
| `defillama.protocol.getChains` | api | `/v2/chains` | — | `order` | `ChainData[]` |
| `defillama.protocol.getProtocols` | api | `/protocols` | — | `sortCondition`, `order` (+top10/field-pick) | `ProtocolData[]` |
| `defillama.protocol.getProtocol` | api | `/protocol/{protocol}` | `protocol` | (essential-field pick) | `ProtocolData` |
| `defillama.protocol.getHistoricalChainTvl` | api | `/v2/historicalChainTvl[/{chain}]` | `chain?` | (last10) | `HistoricalChainTvlItem[]` |
| `defillama.dex.getDexSummary` | api | `/summary/dexs/{protocol}?excludeTotalDataChart&excludeTotalDataChartBreakdown` | `protocol`, `excludeTotalDataChart?`, `excludeTotalDataChartBreakdown?` | — | `DexSummaryResponse` |
| `defillama.dex.getDexsOverview` | api | `/overview/dexs[/{chain}]?excludeTotalDataChart&excludeTotalDataChartBreakdown` | `chain?`, `excludeTotalDataChart?`, `excludeTotalDataChartBreakdown?` | `sortCondition`, `order` (+top10/field-pick) | `DexOverviewResponse` |
| `defillama.fees.getFeesSummary` | api | `/summary/fees/{protocol}?excludeTotalDataChart&excludeTotalDataChartBreakdown&dataType` | `protocol`, `dataType?`, `excludeTotalDataChart?`, `excludeTotalDataChartBreakdown?` | — | `FeesSummaryResponse` |
| `defillama.fees.getFeesOverview` | api | `/overview/fees[/{chain}]?...&dataType` | `chain?`, `dataType?`, `excludeTotalDataChart?`, `excludeTotalDataChartBreakdown?` | `sortCondition`, `order` (+top10/field-pick) | `FeesOverviewResponse` |
| `defillama.options.getOptionsSummary` | api | `/summary/options/{protocol}?dataType` | `protocol`, `dataType?` | — | `OptionsSummaryResponse` |
| `defillama.options.getOptionsOverview` | api | `/overview/options[/{chain}]?...&dataType` | `chain?`, `dataType?`, `excludeTotalDataChart?`, `excludeTotalDataChartBreakdown?` | `sortCondition`, `order` (+top10) | `OptionsOverviewResponse` |
| `defillama.stablecoin.getStablecoins` | stable | `/stablecoins?includePrices=` | `includePrices?` | (top20/field-pick) | `StablecoinsResponse` |
| `defillama.stablecoin.getStablecoinChains` | stable | `/stablecoinchains` | — | (last3) | `StablecoinChainItem[]` |
| `defillama.stablecoin.getStablecoinCharts` | stable | `/stablecoincharts/{chain\|all}?stablecoin=` | `chain?`, `stablecoin?` | (last10) | `StablecoinChartItem[]` |
| `defillama.stablecoin.getStablecoinPrices` | stable | `/stablecoinprices` | — | (last3) | `StablecoinPriceItem[]` |
| `defillama.price.getCurrentPrices` | coins | `/prices/current/{coins}?searchWidth=` | `coins`, `searchWidth?` | — | `CurrentPricesResponse` |
| `defillama.price.getFirstPrices` | coins | `/prices/first/{coins}` | `coins` | — | `FirstPricesResponse` |
| `defillama.price.getBatchHistorical` | coins | `/batchHistorical?coins=&searchWidth=` | `coins` (string\|object), `searchWidth?` | — | `BatchHistoricalResponse` |
| `defillama.price.getHistoricalPrices` | coins | `/prices/historical/{ts}/{coins}?searchWidth=` | `coins`, `timestamp`, `searchWidth?` | — | `CurrentPricesResponse` |
| `defillama.price.getPercentageChange` | coins | `/percentage/{coins}?period&lookForward&timestamp` | `coins`, `period?`, `lookForward?`, `timestamp?` | — | `PercentageResponse` |
| `defillama.price.getPriceChart` | coins | `/chart/{coins}?start&end&span&period&searchWidth` | `coins`, `start?`, `end?`, `span?`, `period?`, `searchWidth?` | — | `ChartResponse` |
| `defillama.yield.getLatestPools` | yields | `/pools` | — | `sortCondition`, `order`, `limit` (+field-pick) | `PoolsResponse` |
| `defillama.yield.getHistoricalPoolData` | yields | `/chart/{pool}` | `pool` | (last10) | `HistoricalPoolResponse` |
| `defillama.blockchain.getBlockAtTimestamp` | coins | `/block/{chain}/{unixTime}` | `chain`, `timestamp` | — | `BlockResponse` |

**Notes baked into Phase 1:**
- `getBatchHistorical`: when `coins` is an object, do `encodeURIComponent(JSON.stringify(coins))` **inside** `*Raw()` (C3).
- `getHistoricalPrices` / `getBlockAtTimestamp` / `getPercentageChange`: keep `toUnixSeconds(timestamp)` coercion inside `*Raw()` (C3).
- `getProtocol` vs `getProtocols`, and `getDexSummary`/`getDexsOverview` etc. are the **multiplexed splits** (one shape each).

---

## Phase 1 — Services → `*Raw()` JSON (+ test tooling)

**Goal:** every service method returns full upstream JSON via `*Raw(args, options?)`; host-side filter/markdown deleted; legacy 19 tools rewired onto `*Raw()` (projection moved into the tool layer); test tooling added. Build + tests green; legacy tools still return equivalent (now JSON) output.

### Task 1.1 — Test tooling + scripts

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

> The Phase-1 service unit tests each spin up their **own inline** `setupServer()`
> (see the sketches below), so no shared msw bootstrap is needed yet.
> `tests/integration/setup.ts` is created in **Phase 5** with the rest of the
> integration harness — don't create it here (it would leave this task's commit
> with an unreferenced file).

- [ ] **Step 1: Add deps and scripts (ADD only — no removals here).** In `package.json`:
  - devDeps: `vitest`, `@vitest/coverage-v8`, `msw`, `cross-env`.
  - scripts: `"pretest": "tsc"`, `"test": "cross-env NODE_OPTIONS=--no-node-snapshot vitest run"`, `"test:watch": "cross-env NODE_OPTIONS=--no-node-snapshot vitest"`.
  - **Do NOT remove `@openrouter/ai-sdk-provider` / `js-tiktoken` here (finding).** Their imports still exist in `base.service.ts` and `services/index.ts`; removing them now would leave this standalone commit with broken imports / a failing `pnpm build`. The removal happens in **Task 1.4 Step 3** (after the importing files are deleted/rewritten) and is committed in the 1.5 unit.

  Run: `pnpm install`
  Expected: lockfile updates (additions only), no peer errors.

- [ ] **Step 2: Add `vitest.config.ts`.**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		environment: "node",
	},
});
```

- [ ] **Step 3: Verify the runner boots.** Run: `pnpm vitest run --reporter=basic` → Expected: "No test files found" (exit 0) — confirms vitest resolves.
- [ ] **Step 4: Commit (additive, stays green).**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest/msw test tooling"
```

### Task 1.2 — `RequestOptions` + base service rewrite

**Files:**
- Modify: `src/services/base.service.ts` (full rewrite)
- Test: `src/services/base.service.test.ts`

- [ ] **Step 1: Write the failing test.** Mirror `debank-mcp/src/services/base.service.test.ts`. Minimum cases: (a) direct fetch returns parsed JSON; (b) when `IQ_GATEWAY_URL`+`IQ_GATEWAY_KEY` set, request goes to the gateway URL with `url`/`projectName`/`cacheDuration` query params and `x-api-key` header; (c) `signal`/`timeout` are forwarded to axios; (d) axios error is rethrown via `extractErrorMessage`. Use msw to intercept.

```ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { protocolService } from "./index.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("BaseService direct fetch", () => {
	it("returns the full upstream JSON unmodified", async () => {
		server.use(
			http.get("https://api.llama.fi/v2/chains", () =>
				HttpResponse.json([{ name: "Ethereum", tvl: 1 }, { name: "BSC", tvl: 2 }]),
			),
		);
		const data = await protocolService.getChainsRaw();
		expect(data).toEqual([{ name: "Ethereum", tvl: 1 }, { name: "BSC", tvl: 2 }]);
	});
});
```

  **Gateway-branch test — env is read at module-load (finding).** `src/env.ts`
  calls `envSchema.parse(process.env)` at import time, and `services/index.ts`
  constructs the singletons at import time, so a statically-imported
  `protocolService` has already captured whatever env was present when the test
  file first loaded. To exercise the IQ Gateway branch you **must** set env →
  `vi.resetModules()` → **dynamically** re-import, in a separate test file or a
  scoped block (don't mix with the static import above):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer();

describe("BaseService IQ Gateway branch", () => {
	afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); server.resetHandlers(); });

	it("routes through the gateway with url/projectName/cacheDuration + x-api-key", async () => {
		vi.stubEnv("IQ_GATEWAY_URL", "https://gw.test/proxy");
		vi.stubEnv("IQ_GATEWAY_KEY", "k");
		vi.resetModules(); // drop cached env.ts + services/index.ts so they re-parse with the stubbed env
		const seen: { url: string; key: string | null } = { url: "", key: null };
		server.listen({ onUnhandledRequest: "error" });
		server.use(
			http.get("https://gw.test/proxy", ({ request }) => {
				seen.url = request.url;
				seen.key = request.headers.get("x-api-key");
				return HttpResponse.json([{ name: "Ethereum", tvl: 1 }]);
			}),
		);
		const { protocolService } = await import("./index.js"); // dynamic re-import AFTER resetModules
		await protocolService.getChainsRaw();
		const u = new URL(seen.url);
		expect(u.origin + u.pathname).toBe("https://gw.test/proxy");
		expect(u.searchParams.get("url")).toContain("api.llama.fi/v2/chains");
		expect(u.searchParams.get("projectName")).toBe("defillama_mcp");
		expect(seen.key).toBe("k");
		server.close();
	});
});
```

- [ ] **Step 2: Run red.** Run: `pnpm vitest run src/services/base.service.test.ts` → Expected: FAIL (`getChainsRaw` not a function / formatResponse still present).

- [ ] **Step 3: Rewrite `base.service.ts`.** Replace the whole file with the DeBank shape, keeping DefiLlama's four host constants and DEFILLAMA_API_KEY header. Reference: `debank-mcp/src/services/base.service.ts`. Concretely:
  - Add `export type RequestOptions = { signal?: AbortSignal; timeout?: number };`
  - Keep `BASE_URL`/`COINS_URL`/`STABLECOINS_URL`/`YIELDS_URL` as `protected readonly`.
  - `protected async fetchData<T>(url, cacheDurationSeconds?, options?: RequestOptions): Promise<T>` → branch IQ Gateway vs direct, forwarding `options?.signal`/`options?.timeout` into axios (spread-guard like debank).
  - Direct path adds `x-api-key: env.DEFILLAMA_API_KEY` when present; gateway path uses `projectName: "defillama_mcp"`.
  - Keep `protected toUnixSeconds(value)` (copy current impl).
  - **Delete** `aiModel`/`dataFilter`/`currentQuery`/`setAIModel`/`setQuery`/`formatResponse` and the tiktoken/`LLMDataFilter`/`toMarkdown` imports.

- [ ] **Step 4: Run green.** Run: `pnpm vitest run src/services/base.service.test.ts` → Expected: PASS (after Task 1.3 defines `getChainsRaw`; if running 1.2 alone, assert against a temporary subclass or land 1.2+1.3 together — do them in one commit).

- [ ] **Step 5: Commit (with 1.3).** See Task 1.3 Step 5.

### Task 1.3 — Convert the 8 services to `*Raw()` (recipe + table)

**Conversion recipe (apply per row in the Reference table):**
1. Rename the method to its `*Raw` qualified `method` name (last segment, e.g. `getChainsRaw`, `getProtocolsRaw`, `getDexSummaryRaw`).
2. Signature: `async fooRaw(args: {<upstream args from table>}, options?: RequestOptions): Promise<<Response type>>`.
3. Body: build the URL exactly as the current method does (same query params), call `return await this.fetchData<T>(url, <ttl>, options);`.
4. **Remove** every client-only transform: `.sort(...)`, `.slice(...)`, `.map(pick fields)`, and the `sortCondition`/`order`/`limit` params. Remove `formatResponse`.
5. For multiplexed services, split the single method into the two `*Raw` methods named in the table; each builds only its own URL (no arg-branching inside `*Raw`).
6. Keep `toUnixSeconds`/`encodeURIComponent` coercions (see Reference notes).

**Files:** `src/config.ts`; `src/services/{protocol,dex,fees,stablecoin,price,yield,options,blockchain}.service.ts`; tests `src/services/<name>.service.test.ts`.

- [ ] **Step 0: Rewrite `config.ts` FIRST (finding — ordering).** The worked
  examples below reference `config.protocolTtl`/`config.dexTtl`/`config.priceTtl`
  etc., and `pretest: tsc` (plus a later `pnpm build`) will type-fail if `config`
  still only has `maxTokens`. So land the TTL config here, before converting any
  service:

```ts
export const config = {
	protocolTtl: 60 * 60,
	dexTtl: 60 * 60,
	feesTtl: 60 * 60,
	optionsTtl: 60 * 60,
	stablecoinTtl: 60 * 60,
	priceTtl: 5 * 60,
	yieldTtl: 30 * 60,
	blockchainTtl: 60 * 60,
} as const;
```

  (Tasks 1.2 + 1.3 + 1.4 + 1.5 are mutually dependent — base service, config,
  services, filter deletion, and the legacy rewire — and land as **one commit**;
  the full build only goes green after 1.5. The per-task `pnpm vitest run`
  checkpoints don't run `tsc` and so can pass earlier.)

- [ ] **Step 1: Worked example A — protocol (split + full payload).** Rewrite `protocol.service.ts`:

```ts
import type { ChainData, HistoricalChainTvlItem, ProtocolData } from "../types.js";
import { config } from "../config.js";
import { BaseService, type RequestOptions } from "./base.service.js";

export class ProtocolService extends BaseService {
	async getChainsRaw(_args?: Record<string, never>, options?: RequestOptions): Promise<ChainData[]> {
		return this.fetchData<ChainData[]>(`${this.BASE_URL}/v2/chains`, config.protocolTtl, options);
	}
	async getProtocolsRaw(_args?: Record<string, never>, options?: RequestOptions): Promise<ProtocolData[]> {
		return this.fetchData<ProtocolData[]>(`${this.BASE_URL}/protocols`, config.protocolTtl, options);
	}
	async getProtocolRaw(args: { protocol: string }, options?: RequestOptions): Promise<ProtocolData> {
		return this.fetchData<ProtocolData>(`${this.BASE_URL}/protocol/${args.protocol}`, config.protocolTtl, options);
	}
	async getHistoricalChainTvlRaw(args: { chain?: string }, options?: RequestOptions): Promise<HistoricalChainTvlItem[]> {
		const url = args.chain
			? `${this.BASE_URL}/v2/historicalChainTvl/${args.chain}`
			: `${this.BASE_URL}/v2/historicalChainTvl`;
		return this.fetchData<HistoricalChainTvlItem[]>(url, config.protocolTtl, options);
	}
}
```

- [ ] **Step 2: Worked example B — dex (multiplex split).** Rewrite `dex.service.ts`:

```ts
import type { DexOverviewResponse, DexSummaryResponse } from "../types.js";
import { config } from "../config.js";
import { BaseService, type RequestOptions } from "./base.service.js";

export class DexService extends BaseService {
	async getDexSummaryRaw(
		args: { protocol: string; excludeTotalDataChart?: boolean; excludeTotalDataChartBreakdown?: boolean },
		options?: RequestOptions,
	): Promise<DexSummaryResponse> {
		const params = new URLSearchParams({
			excludeTotalDataChart: String(args.excludeTotalDataChart ?? true),
			excludeTotalDataChartBreakdown: String(args.excludeTotalDataChartBreakdown ?? true),
		});
		return this.fetchData<DexSummaryResponse>(
			`${this.BASE_URL}/summary/dexs/${args.protocol}?${params}`, config.dexTtl, options,
		);
	}
	async getDexsOverviewRaw(
		args: { chain?: string; excludeTotalDataChart?: boolean; excludeTotalDataChartBreakdown?: boolean },
		options?: RequestOptions,
	): Promise<DexOverviewResponse> {
		const params = new URLSearchParams({
			excludeTotalDataChart: String(args.excludeTotalDataChart ?? true),
			excludeTotalDataChartBreakdown: String(args.excludeTotalDataChartBreakdown ?? true),
		});
		const url = args.chain
			? `${this.BASE_URL}/overview/dexs/${args.chain}?${params}`
			: `${this.BASE_URL}/overview/dexs?${params}`;
		return this.fetchData<DexOverviewResponse>(url, config.dexTtl, options);
	}
}
```

- [ ] **Step 3: Worked example C — price (coins encoding stays inside).** Rewrite `getBatchHistoricalRaw` in `price.service.ts`:

```ts
async getBatchHistoricalRaw(
	args: { coins: string | Record<string, Array<number | string>>; searchWidth?: string | number },
	options?: RequestOptions,
): Promise<BatchHistoricalResponse> {
	const coins = typeof args.coins === "string" ? args.coins : encodeURIComponent(JSON.stringify(args.coins));
	const params = new URLSearchParams({ coins });
	if (args.searchWidth !== undefined) params.append("searchWidth", String(args.searchWidth));
	return this.fetchData<BatchHistoricalResponse>(`${this.COINS_URL}/batchHistorical?${params}`, config.priceTtl, options);
}
```
  Apply the recipe to the other 5 price methods (`getCurrentPricesRaw`, `getFirstPricesRaw`, `getHistoricalPricesRaw`, `getPercentageChangeRaw`, `getPriceChartRaw`) using the current URL-building verbatim minus `formatResponse`.

- [ ] **Step 4: Apply recipe to fees, options, stablecoin, yield, blockchain.** Follow the table. For fees/options, split summary vs overview (drop `processFeesResponse`/`processOptionsResponse` and their slicing). For stablecoin, drop top20/last3/last10 slices. For yield, `getLatestPoolsRaw` returns full `PoolsResponse` (drop sort/limit/field-pick); `getHistoricalPoolDataRaw` returns full `HistoricalPoolResponse`. For blockchain, `getBlockAtTimestampRaw({chain, timestamp})` keeps `toUnixSeconds`.

- [ ] **Step 5: Extend `types.ts`.** Add `DexSummaryResponse`, `FeesSummaryResponse`, `OptionsSummaryResponse`, `BlockResponse` (and confirm `ProtocolData` single-object fields exist). For shapes not fully known, type as the documented fields plus an index signature `[k: string]: unknown` so full payloads pass through without lying about projection.

- [ ] **Step 6: One test per service.** For each service add `<name>.service.test.ts` with an msw handler returning a representative full payload and asserting `*Raw()` returns it **unmodified** (no slice/sort). Multiplexed services: one test per split method (assert correct URL hit). Example for yield:

```ts
it("getLatestPoolsRaw returns the full pools payload (no slice/sort)", async () => {
	const payload = { status: "success", data: Array.from({ length: 50 }, (_, i) => ({ pool: `p${i}`, tvlUsd: i, apy: i })) };
	server.use(http.get("https://yields.llama.fi/pools", () => HttpResponse.json(payload)));
	const out = await yieldService.getLatestPoolsRaw();
	expect(out.data).toHaveLength(50);
});
```

- [ ] **Step 7: Run green.** Run: `pnpm vitest run src/services` → Expected: PASS.
- [ ] **Step 8: Stage (commit lands with 1.5).** `git add src/config.ts src/services` — the
  full build only goes green after the legacy rewire (1.5), so don't commit a
  broken `tsc` mid-way; stage now and commit at 1.5 Step 5.

### Task 1.4 — Delete the host-side filter + markdown

**Files:** Delete `src/utils/data-filter.ts`, `src/lib/utils/markdown-formatter.ts`, `src/lib/integrations/openrouter.ts`. Modify `src/services/index.ts`, `src/env.ts`. (`config.ts` was already rewritten in Task 1.3 Step 0.)

- [ ] **Step 1: `services/index.ts`** — remove the `openrouter` import and the `setAIModel(...)` broadcast block (lines ~6, ~38-47). Keep the eight singleton exports. Module is now side-effect-free.
- [ ] **Step 2: `env.ts`** — remove `OPENROUTER_API_KEY` and `LLM_MODEL` from the zod schema (keep `IQ_GATEWAY_*`, `DEFILLAMA_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` for now).
- [ ] **Step 3: Delete the three files + the now-unused deps.** Run: `git rm src/utils/data-filter.ts src/lib/utils/markdown-formatter.ts src/lib/integrations/openrouter.ts`. Then remove `@openrouter/ai-sdk-provider` and `js-tiktoken` from `package.json` (their only importers — `base.service.ts`, `data-filter.ts`, `services/index.ts` — are now gone/rewritten) and run `pnpm install`. (Deferred from Task 1.1 — finding.)
- [ ] **Step 4: Build.** Run: `pnpm build` → Expected: type errors only from `src/tools/index.ts` (still calls old methods) — fixed in Task 1.5. If errors appear elsewhere, fix imports.
- [ ] **Step 5: Stage (commit lands with 1.5).** `git add src/services/index.ts src/env.ts package.json pnpm-lock.yaml` plus the deletions.

### Task 1.5 — Rewire the legacy 19 tools onto `*Raw()`

**Files:** Modify `src/tools/index.ts`.

- [ ] **Step 1: Strip the query plumbing.** Remove `setQueryFromArgs`, `extractQueryFromContext`, the `_userQuery` schema field on every tool, and the `setQuery(...)` broadcasts inside `getDefillamaTools`'s `fn`.
- [ ] **Step 2: Rewire each tool's `execute`** to call the matching `*Raw()` (dispatching by args for the 4 multiplexed tools), apply the **old projection here** (the sort/slice/field-pick that previously lived in the service), then `return JSON.stringify(result)`. Example for `defillama_get_latest_pool_data`:

```ts
execute: async (args) => {
	const { data } = await yieldService.getLatestPoolsRaw();
	const sorted = [...data].sort((a, b) => {
		const av = (a[args.sortCondition] as number) || 0, bv = (b[args.sortCondition] as number) || 0;
		return args.order === "asc" ? av - bv : bv - av;
	});
	const limited = sorted.slice(0, args.limit).map((p) => ({
		chain: p.chain, project: p.project, tvlUsd: p.tvlUsd,
		apyPct1D: p.apyPct1D, apyPct7D: p.apyPct7D, apyPct30D: p.apyPct30D, apy: p.apy, predictions: p.predictions,
	}));
	return JSON.stringify(limited);
},
```
  For `defillama_get_protocol_data`: if `args.protocol` → `getProtocolRaw` then pick essential fields; else `getProtocolsRaw` then sort+top10. For dex/fees/options: dispatch summary vs overview, apply overview top10/field-pick. `autoResolveEntities` stays unchanged (still uses old LLM resolvers).
- [ ] **Step 3: Build.** Run: `pnpm build` → Expected: PASS (clean).
- [ ] **Step 4: Smoke test the rewired tools.** Add `src/tools/index.test.ts` with one msw-backed case asserting a tool returns JSON-stringified projected output (e.g. chains tool returns top-20 sorted). Run: `pnpm vitest run src/tools` → Expected: PASS.
- [ ] **Step 5: Commit (the whole 1.2–1.5 unit).** Everything staged across Tasks
  1.2–1.4 plus this task lands as one green commit:

```bash
git add src/services src/config.ts src/env.ts src/tools/index.ts src/tools/index.test.ts package.json pnpm-lock.yaml
git commit -m "refactor!: services return full JSON via *Raw(); rewire legacy tools; drop host-side filter + deps"
```

### Task 1.6 — ADR

**Files:** Create `docs/adr/0001-no-host-side-response-filter.md`.

- [ ] **Step 1: Write the ADR** modeled on `debank-mcp/docs/adr/0001-no-host-side-response-filter.md`, but in DefiLlama terms: v0.1 `LLMDataFilter`/`formatResponse`/`_userQuery` singleton state removed; projection now lives in `execute`/`jq_filter`; note the eight services and four hosts. Status: Accepted, Date: 2026-06-01.
- [ ] **Step 2: Commit.** `git add docs/adr/0001-no-host-side-response-filter.md && git commit -m "docs(adr): record removal of host-side response filter"`

**Phase 1 exit:** `pnpm build` + `pnpm test` green; `git grep -n "formatResponse\|LLMDataFilter\|_userQuery\|setAIModel"` returns nothing in `src/`.

---

## Phase 2 — `catalog/tool-metadata.ts` + `response-schemas.ts`

**Goal:** side-effect-free catalog with one entry per upstream endpoint (~23), `parameters` = upstream args only, `responseSchema` = full payload, descriptions written clean (no "via AI"). Enforced by an import test.

### Task 2.1 — `response-schemas.ts`

**Files:** Create `src/mcp/catalog/response-schemas.ts`; Test `src/mcp/catalog/response-schemas.test.ts`.

- [ ] **Step 1: Write zod schemas for each response type** in the Reference table (`ChainsSchema`, `ProtocolsSchema`, `ProtocolSchema`, `HistoricalChainTvlSchema`, `DexSummarySchema`, `DexOverviewSchema`, …). Describe the **full upstream payload** (documented fields + `.passthrough()` / `.catchall(z.unknown())` so unknown fields survive — never a projected subset). Example:

```ts
import { z } from "zod";
export const ChainsSchema = z.array(
	z.object({ name: z.string(), tvl: z.number() }).catchall(z.unknown()),
);
export const PoolsSchema = z.object({
	status: z.string(),
	data: z.array(z.object({ pool: z.string() }).catchall(z.unknown())),
}).catchall(z.unknown());
// …one per response type
```

- [ ] **Step 2: Test** that each schema `.parse()`s a representative full payload and that an extra unknown field is preserved. Run: `pnpm vitest run src/mcp/catalog/response-schemas.test.ts` → PASS.
- [ ] **Step 3: Commit.** `git commit -m "feat(catalog): add response schemas for upstream payloads"`

### Task 2.2 — `tool-metadata.ts` (side-effect-free)

**Files:** Create `src/mcp/catalog/tool-metadata.ts`; Tests `src/mcp/catalog/tool-metadata.import.test.ts`, `tool-metadata.test.ts`.

- [ ] **Step 1: Write the import test first (the invariant) — deterministic, not "no axios fired".**
  The real invariant is *"importing `tool-metadata.js` does not load `services/index.js`"* (that's what `lazyMethod`'s dynamic import buys us). "No network call" is too weak — it would miss an accidental **value** import of `services/index.ts` that constructs the 8 singletons and pulls `env.ts` without making a request. And debank's scrubbed-env trick (a transitive `env.ts` import throws because debank *requires* a key) **does not transfer**: DefiLlama's `env.ts` makes every field optional, so a transitive `env.ts` parse wouldn't fail. So use a **child process with a resolve hook that hard-fails if `services/index.js` is ever resolved.**

  Create `tests/probes/forbid-services-index.hooks.mjs`:

```js
export async function resolve(specifier, context, nextResolve) {
	const r = await nextResolve(specifier, context);
	if (r.url.endsWith("/services/index.js")) {
		throw new Error("FORBIDDEN: services/index.js was loaded during tool-metadata import");
	}
	return r;
}
```

  Create `tests/probes/forbid-services-index.register.mjs`:

```js
import { register } from "node:module";
register("./forbid-services-index.hooks.mjs", import.meta.url);
```

  The test spawns a child that imports the **built** `dist/mcp/catalog/tool-metadata.js` under that hook, with scrubbed env + tmp cwd (belt-and-braces), and asserts clean exit + the expected entry count:

```ts
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("tool-metadata side-effect-freeness", () => {
	it("imports without loading services/index.js (no singleton construction)", () => {
		const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
		const dist = path.resolve(root, "dist/mcp/catalog/tool-metadata.js");
		const register = path.resolve(root, "tests/probes/forbid-services-index.register.mjs");
		const res = spawnSync("node", [
			"--import", register, "--input-type=module", "-e",
			`import { TOOL_METADATA } from ${JSON.stringify(dist)}; process.stdout.write(String(TOOL_METADATA.length));`,
		], { cwd: mkdtempSync(path.join(tmpdir(), "dfl-meta-")), env: { PATH: process.env.PATH ?? "", DOTENV_CONFIG_PATH: "/dev/null" }, timeout: 8_000 });
		expect(res.status, `stderr: ${res.stderr?.toString()}`).toBe(0); // resolve-hook throw → non-zero
		expect(res.stdout.toString()).toBe("23");
	});
});
```

  (Requires `pnpm build` first — `pretest`/`pnpm test` already runs it. The
  test imports the dist artifact, matching debank's approach.)

- [ ] **Step 2: Run red.** Run: `pnpm test` (builds, then runs) → Expected: FAIL (module missing / entry count mismatch).
- [ ] **Step 3: Write `tool-metadata.ts`.** Copy the `lazyMethod` factory and `ToolMetadata` type from `debank-mcp/src/mcp/legacy/tool-metadata.ts` (type-only import of `../../services/index.js`; dynamic import inside the thunk). Add the `ServiceKey` union for the 8 DefiLlama services. Write **~23 entries** from the Reference table. Each entry:
  - `name`: legacy tool name where one exists, else a sensible `defillama_*` name for the split halves (e.g. `defillama_get_protocol` / `defillama_get_protocols`).
  - `qualified`: from the table.
  - `sandboxImpl: lazyMethod("<service>", "<methodRaw>")`.
  - `parameters`: `z.object({...})` of **upstream args only** (no `order`/`sortCondition`/`limit`).
  - `responseSchema`: the matching schema from Task 2.1.
  - `description`: clean, deterministic-resolution wording (no "via AI"); state the `chain:address` format for price endpoints and the `.name` vs `.slug` chain convention where relevant.
  - `exampleCall`: one line, e.g. `await defillama.dex.getDexsOverview({chain: 'ethereum'})`.

  Worked entry:

```ts
{
	name: "defillama_get_chains",
	qualified: "defillama.protocol.getChains",
	sandboxImpl: lazyMethod("protocolService", "getChainsRaw"),
	description: "List all chains DefiLlama tracks, each with current TVL. Returns the full array (sort/slice in your execute() script). Chain display names here (e.g. 'Ethereum') feed api.llama.fi endpoints; lowercase the slug for coins.llama.fi price calls.",
	parameters: z.object({}),
	responseSchema: ChainsSchema,
	exampleCall: "await defillama.protocol.getChains()",
},
```

- [ ] **Step 4: Run green** (import test + a `tool-metadata.test.ts` asserting 23 entries, unique `qualified`, every `sandboxImpl` resolves to a function via `await m.sandboxImpl()`). Run: **`pnpm build && pnpm vitest run src/mcp/catalog`** — the build is required because the import test loads `dist/mcp/catalog/tool-metadata.js`, and bare `pnpm vitest` does **not** run `pretest`/`tsc` (finding), so it would otherwise read missing/stale `dist`. (Or just run `pnpm test`, which builds via `pretest`.) → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(catalog): side-effect-free tool-metadata for 23 endpoints"`

**Phase 2 exit:** `pnpm test` green; import test proves side-effect-freeness.

---

## Phase 3 — Deterministic entity resolver

**Goal:** replace Gemini resolvers with deterministic catalog-backed resolution; `resolveChain` → `{name, slug}`; rewire legacy `autoResolveEntities`; delete LLM resolver/cache deps.

### Task 3.1 — Bundled fallback catalogs

**Files:** Create `src/enums/chains.ts` (and `protocols`/`stablecoins` if a bundled fallback is desired).

- [ ] **Step 1:** Add a minimal bundled `chains` array (`{name, slug, geckoId?}`) covering the top chains, used only when the live `/v2/chains` fetch fails. Keep small. Commit: `git commit -m "feat(enums): bundled chain fallback catalog"`.

### Task 3.2 — `entity-resolver.ts`

**Files:** Create `src/lib/entity-resolver.ts`; Test `src/lib/entity-resolver.test.ts`.

- [ ] **Step 1: Write failing tests.** Cases: (a) `resolveChain("Ethereum")` → `{name:"Ethereum", slug:"ethereum"}`; (b) alias `resolveChain("BSC")`/`"Binance"` → bsc entry; (c) unknown → `null`; (d) network failure falls back to bundled catalog; (e) `resolveProtocol("Lido")` → `"lido"`; (f) `resolveStablecoin("USDC")` → its id. Mock the live catalog with msw.
- [ ] **Step 2: Run red.** `pnpm vitest run src/lib/entity-resolver.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Model the structure on `debank-mcp/src/lib/entity-resolver.ts` (TTL cache + alias table + bundled fallback), adapted:

```ts
import { protocolService, stablecoinService } from "../services/index.js";
import { chains as bundledChains } from "../enums/chains.js";

type ChainResolved = { name: string; slug: string };
const CHAIN_ALIASES: Record<string, string> = { bsc: "bsc", binance: "bsc", "binance smart chain": "bsc", matic: "polygon" };
const TTL_MS = 24 * 60 * 60 * 1000;
let chainCache: { rows: { name: string; slug: string }[]; at: number } | null = null;

async function chainCatalog(): Promise<{ name: string; slug: string }[]> {
	const now = /* injected clock or Date.now via wrapper */ Date.now();
	if (chainCache && now - chainCache.at < TTL_MS) return chainCache.rows;
	try {
		const live = await protocolService.getChainsRaw();
		const rows = live.map((c) => ({ name: c.name, slug: c.name.toLowerCase() }));
		chainCache = { rows, at: now };
		return rows;
	} catch {
		return bundledChains.map((c) => ({ name: c.name, slug: c.slug }));
	}
}

export async function resolveChain(input: string): Promise<ChainResolved | null> {
	const q = input.trim().toLowerCase();
	if (!q) return null;
	const rows = await chainCatalog();
	const byName = rows.find((r) => r.name.toLowerCase() === q || r.slug === q);
	if (byName) return byName;
	const alias = CHAIN_ALIASES[q];
	if (alias) { const r = rows.find((x) => x.slug === alias); if (r) return r; }
	const partial = rows.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase()));
	return partial ?? null;
}
// resolveProtocol(input) over /protocols (match name/slug/symbol → slug); resolveStablecoin(input) over the stablecoins list → numeric id (string)
```

- [ ] **Step 4: Run green.** `pnpm vitest run src/lib/entity-resolver.test.ts` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(resolver): deterministic catalog-backed entity resolver"`

### Task 3.3 — Rewire legacy auto-resolution; delete LLM resolvers

**Files:** Modify `src/tools/index.ts`; modify `src/env.ts`, `package.json`; delete `src/lib/resolvers/`, `src/lib/enums/`, `src/lib/cache/`.

- [ ] **Step 1: Rewire `autoResolveEntities`** to import from `../lib/entity-resolver.js`. For chain: `const r = await resolveChain(args.chain); if (r) args.chain = r.name;` (**`.name`, not the object** — C2/finding). Drop `bridge`/`option` resolution (no tool uses them). Protocol/stablecoin assign their scalar result.
- [ ] **Step 2: Update "via AI" descriptions** in `src/tools/index.ts` (lines ~171, ~177, ~389) to deterministic wording.
- [ ] **Step 3: Delete old modules.** `git rm -r src/lib/resolvers src/lib/enums src/lib/cache` (confirm nothing else imports them via `git grep`). Reconcile/remove the untracked `src/lib/cache/CACHING_IMPLEMENTATION.md`.
- [ ] **Step 4: Drop deps/env.** Remove `@ai-sdk/google`, `@google/generative-ai`, `ai` from `package.json`; remove `GOOGLE_GENERATIVE_AI_API_KEY` from `env.ts`. Run `pnpm install`.
- [ ] **Step 5: Build + test.** `pnpm build && pnpm test` → PASS.
- [ ] **Step 6: Commit.** `git commit -m "refactor!: replace LLM resolvers with deterministic resolver; drop ai/gemini deps"`

**Phase 3 exit:** no `@ai-sdk`/`ai`/`js-tiktoken`/`@openrouter` left in `package.json`; `git grep -n "via AI"` empty; build+test green.

---

## Phase 4 — Build-time codegen

**Goal:** `prebuild` generates the embedded docs index + generated instructions; a stub `instructions.md` exists.

**Files:** Create `scripts/build-docs-index.ts`, `scripts/build-instructions.ts`, `src/mcp/instructions/instructions.md` (stub); generated `src/mcp/search-docs/embedded-index.ts`, `src/mcp/instructions/instructions.generated.ts`; modify `package.json`, add devDeps `tsx`, `minisearch`.

- [ ] **Step 1:** Copy `scripts/build-docs-index.ts` and `scripts/build-instructions.ts` from debank. Adapt: import path `../src/mcp/catalog/tool-metadata.js` (not `legacy`); they already use `z.toJSONSchema` (Zod 4 built-in) — **do not** add `zod-to-json-schema`.
- [ ] **Step 2:** Write a minimal `src/mcp/instructions/instructions.md` stub (one paragraph; fleshed out in Phase 8) so `build-instructions` has input.
- [ ] **Step 3:** Add scripts to `package.json`: `"build:docs": "tsx scripts/build-docs-index.ts"`, `"build:instructions": "tsx scripts/build-instructions.ts"`, `"prebuild": "pnpm run build:docs && pnpm run build:instructions"`. `pretest` now runs `pnpm build`.
- [ ] **Step 4:** Run: `pnpm run prebuild` → Expected: `embedded-index.ts` + `instructions.generated.ts` written; both compile (`pnpm build`).
- [ ] **Step 5: Commit.** `git commit -m "build: prebuild codegen for docs index + instructions"`

**Phase 4 exit:** `pnpm build` regenerates and compiles the generated files; they're unused so far (consumers land in P5/P6/P8).

---

## Phase 5 — Sandbox + bridge

**Goal:** `isolated-vm` sandbox + `defillama.*` client with budget/concurrency/timeout caps and bridge-layer validation.

**Files:** Create `src/mcp/execute/{scope,sandbox,tool,client}.ts` + their `*.test.ts`; integration `tests/integration/{setup.ts, execute.test.ts, lazy-isolated-vm.test.ts, no-isolated-vm.register.mjs, no-isolated-vm.hooks.mjs}`; modify `package.json`.

- [ ] **Step 1:** `package.json` — add `engines.node: ">=22"`, `--no-node-snapshot` on the `start` script, `optionalDependencies`, and the **nested `pnpm` config block** (a top-level dotted `"pnpm.onlyBuiltDependencies"` key is ignored by pnpm — finding):

```json
"optionalDependencies": {
  "isolated-vm": "^6.1.2"
},
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "isolated-vm", "msw"]
}
```
  Run `pnpm install`.
- [ ] **Step 2:** Copy `src/mcp/execute/scope.ts` from debank verbatim; rename env vars `DEBANK_MCP_EXECUTE_*` → `DEFILLAMA_MCP_EXECUTE_*`. Copy its `scope.test.ts`; adjust env names.
- [ ] **Step 3:** Copy `src/mcp/execute/sandbox.ts` and `tool.ts` from debank verbatim (lazy `isolated-vm` import already there). Copy their tests; rename the global namespace `debank` → `defillama` in any assertions.
- [ ] **Step 4:** Copy `src/mcp/execute/client.ts` from debank and adapt **only**: (a) `parseQualified` prefix check `"debank"` → `"defillama"`; (b) global namespace `debank` → `defillama`; (c) the resolver install list at the bottom — install `resolveChain` (returns `{name,slug}`), `resolveProtocol`, `resolveStablecoin` (all async; no `resolveWrappedToken`/sync variant); (d) import `TOOL_METADATA` from `../catalog/tool-metadata.js`. Keep the envelope contract, dual-timeout, `safeParse` bridge validation, and `cancelScope` wiring unchanged. Copy `client.test.ts`; adapt names.
- [ ] **Step 5:** Copy the integration harness files (`tests/integration/setup.ts`, `no-isolated-vm.register.mjs`, `no-isolated-vm.hooks.mjs`) verbatim from debank; adapt `lazy-isolated-vm.test.ts` tool names/qualified ids and `execute.test.ts` to a DefiLlama call (e.g. `await defillama.protocol.getChains()` then project). (`setup.ts` lands here, not in Phase 1 — see Task 1.1 note.)
- [ ] **Step 6:** Run: `pnpm test` → Expected: PASS (isolated-vm tests run under `--no-node-snapshot`; no-isolated-vm path proves graceful degradation).
- [ ] **Step 7: Commit.** `git commit -m "feat(execute): isolated-vm sandbox + defillama.* bridge with scope caps"`

**Phase 5 exit:** sandbox tests green; server still starts when `isolated-vm` is absent (only `execute` disabled).

---

## Phase 6 — `search_docs` + cookbook

**Goal:** `search_docs` MiniSearch tool + DefiLlama cookbook recipes baked into the index.

**Files:** Create `src/mcp/search-docs/tool.ts` (copy from debank), `src/mcp/search-docs/cookbook/*.md`; tests `src/mcp/search-docs/tool.test.ts`, `tests/integration/search-docs.test.ts`.

- [ ] **Step 1:** Copy `src/mcp/search-docs/tool.ts` from debank verbatim (it reads `embedded-index.ts` from Phase 4).
- [ ] **Step 2:** Write 8–10 DefiLlama `cookbook/*.md` recipes (per spec C8): top-N protocols by TVL w/ chain breakdown; DEX volume leaderboard for a chain; fees-vs-revenue join; stablecoin mcap by chain; token price history via `chain:address`; block-at-timestamp → historical TVL; yield pool screen by APY/TVL then drill into pool history. Each recipe shows a runnable `execute()` snippet using `defillama.*`.
- [ ] **Step 3:** Re-run `pnpm run build:docs` so cookbook + catalog land in the index. Add `tool.test.ts` asserting a query (e.g. "top protocols by tvl") returns a cookbook hit. Run: `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(search-docs): MiniSearch tool + DefiLlama cookbook recipes"`

---

## Phase 7 — Dynamic tools

**Goal:** `defillama_resolve`, `list_endpoints`, `get_endpoint_schema`, `invoke_endpoint` (with `jq_filter` + dual-timeout), all behind the dynamic flag.

**Files:** Create `src/mcp/tools.ts`, `src/mcp/endpoints/tools.ts`; tests `src/mcp/tools.test.ts`, `src/mcp/endpoints/tools.test.ts`.

- [ ] **Step 1:** `src/mcp/tools.ts` — `defillama_resolve` tool: params `{ kind: 'chain'|'protocol'|'stablecoin', query: string }`; calls the Phase-3 resolver; returns JSON (`{name,slug}` for chain). Test it. Commit.
- [ ] **Step 2:** `src/mcp/endpoints/tools.ts` — copy structure from `debank-mcp/src/mcp/endpoints/tools.ts`: `list_endpoints` (map `TOOL_METADATA` → `{name, qualified, description}`), `get_endpoint_schema` (`z.toJSONSchema(m.parameters)` + `z.toJSONSchema(m.responseSchema)`), `invoke_endpoint` (resolve `sandboxImpl`, `safeParse` args, apply same 5s+6s dual-timeout, optional `jq_filter` via `jqts` with single-output unwrap). Adapt `catalog` import + `defillama` qualified prefix. Copy/adapt its test.
- [ ] **Step 3:** Run: `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(dynamic): defillama_resolve + list/get-schema/invoke endpoint tools"`

---

## Phase 8 — Server entry + ADK adapter; delete legacy

**Goal:** register `execute` + `search_docs` by default, gate dynamic tools, pass `instructions`; move ADK to `src/adk/`; delete `src/tools/index.ts`; finalize env mechanics.

**Files:** Rewrite `src/index.ts`, `src/env.ts`; create `src/adk/index.ts` + `src/adk/index.test.ts`; flesh out `src/mcp/instructions/instructions.md`; delete `src/tools/index.ts`; integration `tests/integration/setup-smoke.test.ts`.

- [ ] **Step 1:** Rewrite `src/index.ts` modeled on `debank-mcp/src/index.ts`: semver assert from `package.json`; `dynamicToolsEnabled()` checks `--tools=dynamic` / `DEFILLAMA_MCP_TOOLS=dynamic`; register `[executeTool, searchDocsTool]` always, push `[...dynamicConvenienceTools, ...endpointTools]` when enabled; pass `instructions: INSTRUCTIONS` from `instructions.generated.js`. Shebang `#!/usr/bin/env -S node --no-node-snapshot`.
- [ ] **Step 2:** `src/env.ts` — `import { config } from "dotenv"`; resolve path from `import.meta.url` (script dir's parent); `config({ quiet: true, path: <resolved> })`; add `DEFILLAMA_MCP_TOOLS` to the schema. (LLM keys already gone.)
- [ ] **Step 3:** `src/adk/index.ts` — `getDefillamaTools()` wrapping `execute` + `search_docs` (+ dynamic when enabled) as `@iqai/adk` `createTool(...)`. **No** `_userQuery`/context plumbing. Test that it returns tools and that calling the `execute` ADK tool runs a trivial script.
- [ ] **Step 4:** Flesh out `instructions.md` (top operations, group taxonomy C1, chain-ID `.name`/`.slug` convention C2, `chain:address` price format C3, IQ Gateway note D-2, sandbox limits C7). Re-run `pnpm run build:instructions`.
- [ ] **Step 5:** `git rm src/tools/index.ts` (+ its test if superseded). Fix any remaining imports.
- [ ] **Step 6:** `tests/integration/setup-smoke.test.ts` — spawn the built server, list tools, assert exactly `execute` + `search_docs` by default, and the 4 extra under `DEFILLAMA_MCP_TOOLS=dynamic`.
- [ ] **Step 7:** Run: `pnpm build && pnpm test` → PASS.
- [ ] **Step 8: Commit.** `git commit -m "feat!: two-tool default surface + opt-in dynamic; ADK adapter; delete legacy tools"`

**Phase 8 exit:** default surface is `execute` + `search_docs`; dynamic flag adds four; ADK export works; `src/tools/index.ts` gone.

---

## Phase 9 — README + docs + changeset

**Files:** Rewrite `README.md`; optional `docs/style/code-comments.md`; create `.changeset/<name>.md`.

- [ ] **Step 1:** Rewrite `README.md` mirroring `debank-mcp/README.md` structure: Architecture diagram, Mermaid sequence diagram, default vs dynamic tools, Safety limits (budget/concurrency/timeouts), `jq_filter`, Error envelopes, ADK usage, Node 22 + absolute-path-in-`command` note (gotcha #3), Screenshots placeholder. No version-specific claims (gotcha #16).
- [ ] **Step 2:** Add one changeset (`.changeset/*.md`) describing the breaking change (single changeset for the whole PR per D-5). Run: `pnpm changeset` or hand-author.
- [ ] **Step 3: Commit.** `git commit -m "docs: rewrite README for Code Mode; add breaking-change changeset"`

**PR exit:** `pnpm build` + `pnpm test` green; default surface = 2 tools; dynamic = +4; ADK + IQ Gateway + four hosts intact; no LLM filter/resolver/deps remain.

---

## Self-review (run after the plan is written; fix inline)

- **Spec coverage:** D1–D18 deltas → D1/D2/D10 (P8), D3 (P1), D4 (P1+P5+P7), D5 (P1.4/1.5), D6 (P3), D7 (P5), D8 (P5 client + P7 invoke), D9 (P4+P6), D11 (P2), D12 (P4), D13 (every phase), D14 (P5), D15 (P8), D16/D17 (P1), D18 (P1/P3/P8). C1 (P2 taxonomy), C2 (P3 `{name,slug}`), C3 (P1 recipe notes), C4 (P8 ADK), C5 (P1+P3 dep staging), C6 (P1 config), C7 (P5 caps + P8 instructions), C8 (P6 cookbook), C9 (P4 stub → P8 full). Multiplex split (P1/P2). ✅
- **Placeholder scan:** copy-from-debank tasks name the exact source file + enumerate adaptations; the 23-method recipe is backed by the full Reference table; no "TBD"/"add error handling"/"similar to". ✅
- **Type consistency:** `*Raw` names in Phase 1 examples match the Reference `qualified` method segments and the `lazyMethod("<service>","<methodRaw>")` calls in Phase 2; `resolveChain` returns `{name,slug}` in P3 and is consumed as `.name` in P3.3 and installed async in P5.4. ✅
