# Resolve chain, protocol, and stablecoin names

Translates human-facing names into the exact identifiers each DefiLlama endpoint expects, deterministically (no LLM). The key convention: a chain resolves to BOTH a `name` and a `slug` — use `.name` for api.llama.fi group endpoints (protocols, dexs, fees, historical chain TVL) and `.slug` for coins.llama.fi calls (prices, block-at-timestamp). Protocols resolve to a slug string; stablecoins resolve to a numeric id string. Each resolver returns `null` when the input doesn't match any catalog entry — handle that with the enumerate-and-filter fallback below.

```js
async function run(defillama, { chainInput, protocolInput, stablecoinInput }) {
  const chain = await defillama.resolveChain(chainInput); // { name, slug } | null
  const protocol = await defillama.resolveProtocol(protocolInput); // slug string | null
  const stablecoin = await defillama.resolveStablecoin(stablecoinInput); // numeric-id string | null

  // Use .name for api.llama.fi groups, .slug for coins/price endpoints.
  return {
    chainName: chain?.name, // -> getHistoricalChainTvl({ chain: chain.name })
    chainSlug: chain?.slug, // -> getBlockAtTimestamp({ chain: chain.slug })
    protocolSlug: protocol, // -> getProtocol({ protocol })
    stablecoinId: stablecoin, // -> getStablecoinCharts({ stablecoin })
  };
}
```

When the resolver returns `null` — the input is ambiguous, imprecise, or doesn't appear in the catalog under any close spelling — fall back to enumerate-and-filter on the upstream catalog. See the `find-protocol-slug` recipe for the worked pattern (`defillama.protocol.getProtocols()` → filter by `name` substring → read `slug` off the response). The same shape works for chains (`getChains()`) and stablecoins (`getStablecoins()` → `peggedAssets`).
