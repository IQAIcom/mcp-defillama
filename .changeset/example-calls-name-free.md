---
"@iqai/defillama-mcp": patch
---

Fix the upstream defect where every `exampleCall` in the endpoint catalog hard-coded a protocol slug, chain name, stablecoin id, pool UUID, or token address — values the model would copy verbatim from `search_docs` output and pass to the endpoint, often hitting null responses. The reported case was `defillama.fees.getFeesSummary({ protocol: 'uniswap' })` failing because the fees catalog has no unversioned `uniswap` slug (only `uniswap-v2`, `uniswap-v3`, `uniswap-labs`, etc.).

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
