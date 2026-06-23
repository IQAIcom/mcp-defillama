---
"@iqai/defillama-mcp": patch
---

Three coordinated fixes for the huge-payload class of session failures (Q1 context overflow on broad fetches, Q11 inability to unwrap nested responses, Q3/Q7 5-10min post-processing on time-series).

**1. Narrow-vs-broad guidance on broad list endpoints.** `getProtocols`, `getChains`, `getDexsOverview`, `getFeesOverview`, `getOptionsOverview`, `getLatestPools`, `getStablecoins`, and `getStablecoinChains` descriptions now explicitly say *"prefer the narrow `getX({slug})` endpoint when you know the target — `getXs()` is for cross-X aggregates and the resolver fallback only, and you must project/filter inside `execute()` before returning."* `getProtocols` calls out the payload size (~3k entries, several MB) so the size cost is visible up front.

**2. Response shaping in every `exampleCall`.** Every endpoint's example now demonstrates the right size-discipline pattern instead of returning the raw call:

- Broad lists → `sort → slice(0, 20) → map(p => ({ ...specific fields }))`
- Time-series (`getHistoricalChainTvl`, `getStablecoinCharts`, `getStablecoinPrices`, `getHistoricalPoolData`) → `series.slice(-90).map(p => ({ ...specific fields }))`
- Single-entity summaries (`getProtocol`, `getDexSummary`, `getFeesSummary`, `getOptionsSummary`) → destructure / pluck the 5-7 fields the question typically needs, instead of returning the full 30+ field object
- Price endpoints (all six in the `price.*` namespace) → unwrap the nested `res.coins?.[key]?.price` / `.prices` instead of returning the raw `{ coins: { ... } }` wrapper

**3. New always-loaded instructions section "Shape responses inside `execute()` — don't ship raw payloads back".** Sits between "Price coin format" and "IQ Gateway". States the rule (the sandbox is for trimming/shaping at the source; the return value should already be the small thing the agent will reason about), gives three labelled patterns (lists / time-series / summaries), notes the nested-`coins[key]` shape, and reiterates the narrow-vs-broad preference.

Equivalent class of bug to the `getFeesSummary` fix in 1.0.6 — same lever (descriptions + exampleCalls demonstrate the right behavior), different axis ("project before returning" instead of "discover before invoking").
