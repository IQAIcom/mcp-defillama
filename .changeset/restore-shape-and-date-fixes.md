---
"@iqai/defillama-mcp": patch
---

Restore the shape-discipline and time-series Date-conversion exampleCall work that was lost when `main` was force-pushed back to a pre-PR-#28 state by a compromised maintainer credential. The malicious commit has already been removed from `main` (in PR #31); this PR re-applies the substantive fixes from the merged-then-lost PR #28 and PR #30 on top of the now-clean main.

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
