# Resolve chain, protocol, and stablecoin names

Translates human-facing names into the exact identifiers each DefiLlama endpoint expects, deterministically (no LLM). The key convention: a chain resolves to BOTH a `name` and a `slug` — use `.name` for api.llama.fi group endpoints (protocols, dexs, fees, historical chain TVL) and `.slug` for coins.llama.fi calls (prices, block-at-timestamp). Protocols resolve to a slug string; stablecoins resolve to a numeric id string.

```js
async function run(defillama) {
  const chain = await defillama.resolveChain("BSC"); // {name:"BSC", slug:"bsc"}
  const protocol = await defillama.resolveProtocol("Lido"); // "lido"
  const stablecoin = await defillama.resolveStablecoin("USDC"); // e.g. "2"

  // Use .name for api.llama.fi groups, .slug for coins/price endpoints.
  return {
    chainName: chain?.name, // -> getHistoricalChainTvl({chain: chain.name})
    chainSlug: chain?.slug, // -> getBlockAtTimestamp({chain: chain.slug})
    protocolSlug: protocol, // -> getProtocol({protocol})
    stablecoinId: stablecoin, // -> getStablecoinCharts({stablecoin})
  };
}
```
