# @iqai/defillama-mcp

## 1.0.8

### Patch Changes

- [#32](https://github.com/IQAIcom/mcp-defillama/pull/32) [`f8794e1`](https://github.com/IQAIcom/mcp-defillama/commit/f8794e14008a18d42425f0c6dabc95e1888ebb4a) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Restore the shape-discipline and time-series Date-conversion exampleCall work that was lost when `main` was force-pushed back to a pre-PR-#28 state by a compromised maintainer credential. The malicious commit has already been removed from `main` (in PR #31); this PR re-applies the substantive fixes from the merged-then-lost PR #28 and PR #30 on top of the now-clean main.

  **What was lost (and is now restored):**

  - **Narrow-vs-broad guidance** on broad list endpoints (`getProtocols`, `getChains`, `getDexsOverview`, `getFeesOverview`, `getOptionsOverview`, `getLatestPools`, `getStablecoins`, `getStablecoinChains`). Descriptions now explicitly recommend the narrow `getX({slug})` endpoint when the target is known and require projection/filtering inside `execute()` before returning. `getProtocols` calls out its payload size (~3k entries, several MB) so the size cost is visible up front.

  - **Response shaping in every `exampleCall`.** Each endpoint's example now demonstrates the right size-discipline pattern instead of returning the raw call:

    - Broad lists → `sort → slice(0, 20) → map(p => ({ ...specific fields }))`
    - Time-series (`getHistoricalChainTvl`, `getStablecoinCharts`, `getStablecoinPrices`, `getHistoricalPoolData`) → `series.slice(-90).map(p => ({ ...specific fields }))`
    - Single-entity summaries (`getProtocol`, `getDexSummary`, `getFeesSummary`, `getOptionsSummary`) → destructure / pluck the 5-7 fields the question typically needs, instead of returning the full 30+ field object
    - Price endpoints (all six in `price.*`) → unwrap nested `res.coins?.[key]?.price` / `.prices` instead of returning the raw `{ coins: { ... } }` wrapper

  - **Unix-seconds-vs-milliseconds JS Date fix** on the three `/v2`-style time-series endpoints (`getHistoricalChainTvl`, `getStablecoinCharts`, `getStablecoinPrices`). DefiLlama returns `date` as Unix seconds; JS `new Date(n)` expects milliseconds — so without the conversion the model gets `1970-01-XX` dates. The exampleCalls now demonstrate `new Date(p.date * 1000).toISOString()` inline. `getHistoricalPoolData` is left alone because its `timestamp` is already an ISO string (asymmetry called out via a one-line comment so the model doesn't apply `* 1000` there by mistake).

  - **Upstream-shape correctness in `getProtocol` exampleCall.** The `/protocol/{slug}` endpoint returns `tvl` as a 2012-entry array of `{date, totalLiquidityUSD}`, not a top-level number; `change_1d` / `change_7d` don't exist on this endpoint at all. The exampleCall now plucks `p.tvl?.[p.tvl.length - 1]?.totalLiquidityUSD` so a literal `tvl: p.tvl` projection doesn't ship the full historical series back. (Latent bug in `ProtocolSchema` / `ProtocolData` type — declared `tvl: number` — still tracked separately, out of scope here.)

  - **`getHistoricalPoolData` response unwrap.** Schema declares `{ data: HistoricalPoolItem[] }` — the exampleCall now uses `(series.data ?? []).slice(-90).map(...)` instead of `series.slice(-90)` which would have TypeError'd.

  - **Null/undefined guards** on the pool-lookup-then-fetch chain: `(pools.data ?? []).find(...)?.pool`, then `if (!id) return { error: 'Pool not found' }` before calling `getHistoricalPoolData`, so the Zod `pool: z.string()` validation can't be tripped.

  - **New always-loaded instructions section** "Shape responses inside `execute()` — don't ship raw payloads back". States the rule (the sandbox is for trimming/shaping at the source; the return value should already be the small thing the agent will reason about), gives three labelled patterns (lists / time-series / summaries), notes the nested-`coins[key]` shape, and reiterates the narrow-vs-broad preference.

  **What is unchanged from current `main`:**

  - The malicious `vitest.config.ts` payload removed by PR #31 stays removed.
  - `axios` stays at `^1.12.2` (the malicious downgrade to `^1.9.0` is not re-introduced).
  - No changes to test files, services, or build tooling.

  Original PRs whose content this restores: #28 (shape-large-payloads), #30 (time-series-date-conversion). See the audit thread on PR #31 / the security incident notes for context on how the work was lost.

## 1.0.7

### Patch Changes

- [#26](https://github.com/IQAIcom/mcp-defillama/pull/26) [`f9dc3a8`](https://github.com/IQAIcom/mcp-defillama/commit/f9dc3a863db034c0179e992ba005f84121b99aa3) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Fix the upstream defect where every `exampleCall` in the endpoint catalog hard-coded a protocol slug, chain name, stablecoin id, pool UUID, or token address — values the model would copy verbatim from `search_docs` output and pass to the endpoint, often hitting null responses. The reported case was `defillama.fees.getFeesSummary({ protocol: 'uniswap' })` failing because the fees catalog has no unversioned `uniswap` slug (only `uniswap-v2`, `uniswap-v3`, `uniswap-labs`, etc.).

  Every `exampleCall` in `src/mcp/catalog/tool-metadata.ts` now demonstrates the discovery flow before the call:

  - Protocol-slug endpoints (`getProtocol`, `getDexSummary`, `getFeesSummary`, `getOptionsSummary`): `const slug = await defillama.resolveProtocol(name); await defillama.<...>({ protocol: slug })`
  - Chain-name endpoints (`getHistoricalChainTvl`, `getDexsOverview`, `getFeesOverview`, `getOptionsOverview`): `const {name} = await defillama.resolveChain(input); await defillama.<...>({ chain: name })`
  - Chain-slug endpoints (coins.llama.fi: `getBlockAtTimestamp`, all `price.*`): `const {slug} = await defillama.resolveChain(input); ...`
  - Stablecoin charts: resolves both chain and stablecoin id first
  - Yield historical pool data: discovers the opaque pool UUID via `getLatestPools()` first
  - Price endpoints' `coins` parameter: built as `` `${slug}:${tokenAddress}` `` from the resolved chain slug plus a caller-supplied address (no DefiLlama-side address discovery exists, so the description documents the user/wallet/explorer source)

  Parameter `.describe()` strings updated in parallel: dropped the "(e.g. 'lido', 'uniswap', 'aave-v3')" format-by-example pattern and replaced it with explicit pointers to `defillama.resolveProtocol(name)` / `defillama.resolveChain(input)` / `defillama.resolveStablecoin(symbol)` and the relevant enumerate-via-`get*Overview` fallback. Each description now says explicitly: "never construct it by transforming a display name."

  Cookbook recipes touched for the same hazard:

  - `instructions.md` — "Price coin format" section now shows the template-string form with a resolver-first code block; drops the literal WETH address.
  - `02-dex-volume-leaderboard.md`, `05-token-price-history.md`, `06-block-at-timestamp-tvl.md` — take a `chainInput` (and `tokenAddress` where relevant) parameter on the `run` function instead of hard-coding `"Ethereum"` and a USDT address.
  - `08-resolve-names.md` — resolver demonstrations now take `{ chainInput, protocolInput, stablecoinInput }` parameters.
  - `09-find-protocol-slug.md` — resolver call takes `protocolInput`; the "Once you have the canonical slug" follow-up bullets now show endpoint calls using the `slug` variable instead of literal `"aave-v3"` / `"uniswap-v3"` / `"lyra"`; also adds a note that fees / DEX / options each have a distinct slug namespace (which is why an unversioned guess against the fees catalog fails).

  Equivalent class of bug to debank-mcp issue #89. The regenerated `embedded-index.ts` and `instructions.generated.ts` ship the new examples to the agent surface.

## 1.0.6

### Patch Changes

- [#24](https://github.com/IQAIcom/mcp-defillama/pull/24) [`785b8f6`](https://github.com/IQAIcom/mcp-defillama/commit/785b8f6ac1c372f0f6f9745b1d44cb8012cf3b1c) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Add an "ID discovery" instruction + a `find-protocol-slug` cookbook recipe so agents stop guessing protocol slugs when the resolver returns null.

  `defillama.resolveProtocol` and `defillama.resolveStablecoin` only do exact case-insensitive matches on slug/name/symbol — when an agent passes an imprecise input like `"aave"` (no version), `"USD Coin"` vs `"usd-coin"`, or a partial like `"pancake"`, the resolver returns `null`. Without an upfront discovery path, the agent's reflex is to construct a slug by hand (`aave_v3`, `usd_coin`, `pancakeswap_v3`) — DefiLlama's slug scheme doesn't match any of those, so the call fails and the agent burns budget retrying variants.

  Two coordinated additions:

  - **`src/mcp/instructions/instructions.md`** — new always-loaded section "Discovering IDs — resolve or enumerate, don't guess" between "Chain identifiers" and "Price coin format". States the rule (resolve first, fall back to enumerate, never transform a display name into a slug) and points at the cookbook recipe.
  - **`src/mcp/search-docs/cookbook/09-find-protocol-slug.md`** — a worked recipe showing the resolver-first / enumerate-and-filter fallback on `defillama.protocol.getProtocols()`. Covers protocol-slug discovery in depth and notes how the same shape applies to chains (`getChains()`) and stablecoins (`getStablecoins().peggedAssets`). Existing `08-resolve-names.md` links to it for the "resolver returned null" case.

  No fixed lookup table baked into the always-loaded instructions — that would be the cheat-sheet anti-pattern. The cookbook is the right surface: loaded on demand via `search_docs`, not on every session.

  Inspired by debank-mcp's [`find-protocol-id` recipe](https://github.com/IQAIcom/mcp-debank/blob/main/src/mcp/search-docs/cookbook/11-find-protocol-id.md) and the [ID-discovery instruction](https://github.com/IQAIcom/mcp-debank/commit/73dfce2) that ships alongside it.

## 1.0.5

### Patch Changes

- [#22](https://github.com/IQAIcom/mcp-defillama/pull/22) [`5ff2511`](https://github.com/IQAIcom/mcp-defillama/commit/5ff251101644896538ab69b54098d298570ada6f) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Post-`test.yml` cleanup bundle — three small, related fixes:

  1. **Logger now defaults to color only on a TTY.** `createLogger`'s `colorize` option previously defaulted to `true` unconditionally, which meant MCP hosts like Claude Desktop (which capture stderr to a non-TTY log file) saw raw ANSI escape codes like `␛[32m`…`␛[39m` in their logs. The new default is `process.stderr?.isTTY === true`, so terminal sessions still get colored output while captured/redirected stderr stays clean. The option remains overridable via `createLogger({ colorize: true })` for callers that want to force color.

  2. **Delete `.github/workflows/push.yml`.** After PR #20 added `test.yml`, `push.yml` became a strict subset of it (install → build → lint, all also done by `test.yml`). The two workflows ran in parallel on every push, duplicating ~30s of work each time. Deleting `push.yml` removes the duplication; all CI gating now flows through `test.yml`.

  3. **Add a `concurrency:` block to `test.yml`.** Uses `github.head_ref || github.ref` so a PR push's two events (push + pull_request) share a concurrency group and cancel each other instead of running the workflow twice. Also cancels in-flight runs on rebases/force-pushes — saves CI time during iterative review.

  No published-artifact change beyond the logger TTY default (which is observable to anyone capturing the server's stderr).

## 1.0.4

### Patch Changes

- [#20](https://github.com/IQAIcom/mcp-defillama/pull/20) [`b8e75bb`](https://github.com/IQAIcom/mcp-defillama/commit/b8e75bb5187371c94efa0621a9262ff5c284c095) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Add a `test.yml` GitHub Actions workflow so CI now runs the full test suite, an `isolated-vm` smoke test, and a generated-files drift check on every push and pull request.

  Previously the only CI workflow (`push.yml`) ran `install → build → lint`, with no execution of `pnpm test`. PRs could merge green without the 171-test suite ever running in CI — local test runs were the only safety net. The new workflow adds three concrete gates:

  - **`pnpm test`** — runs the vitest suite (171 tests today).
  - **isolated-vm smoke** — compiles and runs `1 + 1` inside an isolate, catching native-module breakage at install time before the rest of the suite runs.
  - **Generated-files diff check** — `git diff --exit-code` against `src/mcp/search-docs/embedded-index.ts` and `src/mcp/instructions/instructions.generated.ts` so the build's regenerated outputs can't drift from what's committed.

  No published-artifact change — CI tooling only. Ported (with adapted action versions and generated-file paths) from debank-mcp's `test.yml`.

## 1.0.3

### Patch Changes

- [#18](https://github.com/IQAIcom/mcp-defillama/pull/18) [`2ed58da`](https://github.com/IQAIcom/mcp-defillama/commit/2ed58da63ceae71ea0f6d7b9943ee56c343fa9c2) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Drop `--write` from the `lint` script so CI fails on lint violations instead of silently auto-fixing them.

  `pnpm lint` was previously `biome check . --write`, which would fix any auto-fixable issue in place and exit 0 — meaning CI would never surface a lint problem to a PR author. The new `biome check .` exits non-zero on any violation, making `pnpm lint` honest for CI gating.

  Local developers wanting the auto-fix behavior should use `pnpm format` (still `biome format . --write`) or the pre-commit `lint-staged` hook (still `biome check --write`).

  No published-artifact change — this is a dev/CI-only fix. The published package remains bit-for-bit identical.

  Ported from debank-mcp ([`lint: biome check .`](https://github.com/IQAIcom/mcp-debank/blob/main/package.json)).

## 1.0.2

### Patch Changes

- [#16](https://github.com/IQAIcom/mcp-defillama/pull/16) [`b370a41`](https://github.com/IQAIcom/mcp-defillama/commit/b370a412994509a6519cef1b20a6c49556dab1bc) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Plumb a per-method `timeoutMs` override through the execute client so the axios timeout scales with the wrapper deadline.

  `ToolMetadata` gains an optional `timeoutMs?: number` field, and `execute/client.ts` now derives both the wrapper abort timer and the underlying axios timeout from it (`axiosMs = abortMs + AXIOS_BUFFER_MS`, defaulting to 5 s + 1 s = 6 s as before). Without this wiring, a `timeoutMs` override on a direct (non-aggregate) endpoint would be silently no-op'd by the hardcoded 6 s axios timeout — axios would reject before the wrapper budget ever applied.

  No per-method overrides are set in this change; the behavior is bit-for-bit identical to before for every current endpoint (default `abortMs = 5_000`, `axiosMs = 6_000`, error message `"DefiLlama call timed out after 5s: …"`). The change unblocks tuning slow endpoints in follow-up PRs without re-touching the client.

  Ported from debank-mcp 33a17d1 (the equivalent reference fix for the same Code Mode client).

- [#15](https://github.com/IQAIcom/mcp-defillama/pull/15) [`6da05e8`](https://github.com/IQAIcom/mcp-defillama/commit/6da05e82052f0cea35bad6b0e23f38cdaaa6cd69) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Chain `pnpm run build` after husky in the `prepare` script so source/git installs end up with a built `dist/`.

  This is a **dev-only** change — npm registry consumers are unaffected because the published tarball already ships a pre-built `dist/` and `prepare` doesn't run for tarball installs. The fix matters for anyone installing from a git ref (e.g. `pnpm add github:IQAIcom/mcp-defillama`) or cloning the repo, where `prepare` previously left them without the executable referenced by the `bin` entry. The published package remains bit-for-bit identical to the previous version.

  Ported from debank-mcp 7ebd794.

## 1.0.1

### Patch Changes

- [#11](https://github.com/IQAIcom/mcp-defillama/pull/11) [`4213936`](https://github.com/IQAIcom/mcp-defillama/commit/42139366d86c72d8f35303558f46ccf748b984e6) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Fail fast with a clear, actionable message when the server is launched under Node < 22 instead of crashing with a cryptic `ReferenceError: File is not defined` from undici. A dependency-free preflight in the bin entry checks the Node version before importing anything that loads undici (the FastMCP wiring moves to `server.ts`), and the README gains a Troubleshooting section covering the absolute-Node-path client config.

## 1.0.0

### Major Changes

- [#6](https://github.com/IQAIcom/mcp-defillama/pull/6) [`8e7f15d`](https://github.com/IQAIcom/mcp-defillama/commit/8e7f15d65ee5a3632284cb5a8a3b107fe5280694) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Refactor to Stainless-style Code Mode. The default tool surface is now `execute` + `search_docs` (the ~19 `defillama_*` endpoint-specific tools are removed; per-endpoint access moves to `invoke_endpoint` under `--tools=dynamic`). The host-side LLM response filter is removed and entity resolution is now deterministic (Gemini/OpenRouter dependencies and their `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `LLM_MODEL` env vars are removed). The `execute` tool runs agent-authored JavaScript in an `isolated-vm` sandbox against a pre-wired `defillama.*` client with per-invocation budget, concurrency, and timeout caps. The ADK `getDefillamaTools()` export moves to the `adk` entry point (`dist/adk/index.js`). Node >= 22 is now required.
