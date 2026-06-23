---
"@iqai/defillama-mcp": patch
---

Fix the classic Unix-seconds-vs-milliseconds JS Date trap in the time-series `exampleCall`s by demonstrating the `* 1000` conversion inline.

Session evidence from a recent Aiden Phase-3 Q3 run: the model fetched historical TVL, hit `new Date(p.date)` (without the `* 1000`), got `1970-01-XX` dates, then burned ~54s in retry/recover loops on the formatting and finally returned a degraded answer.

Root cause is upstream-shape, not model error: DefiLlama returns `date` as Unix **seconds** on the `/v2`-style endpoints, while JS `new Date(n)` expects **milliseconds**. Verified live (`curl https://api.llama.fi/v2/historicalChainTvl/Ethereum` → `date: 1782172800`): only `new Date(1782172800 * 1000)` resolves correctly to today; the bare form yields `1970-01-21`.

Same lever as the prior shape-discipline fixes (1.0.6 / 1.0.7 / 1.0.8) — the `exampleCall` is the contract surfaced to the model via `search_docs`. Three of the four time-series endpoints get the conversion demonstrated inline in their projection:

- `getHistoricalChainTvl`
- `getStablecoinCharts`
- `getStablecoinPrices`

Each becomes:

```js
date: new Date(p.date * 1000).toISOString()
  /* p.date is Unix seconds; multiply by 1000 for JS Date */
```

The fourth time-series endpoint (`getHistoricalPoolData`) is handled differently because `HistoricalPoolItemSchema` declares `timestamp: z.string()` — i.e. already an ISO string from the yields API, no `* 1000` needed. Added an inline comment there making the asymmetry explicit so the model doesn't apply the `* 1000` pattern by mistake.

No instructions.md change. A generic "Unix-seconds vs ms" hint would be cheat-sheet territory; the right surface for this is the per-endpoint exampleCall demonstrating the right idiom.
