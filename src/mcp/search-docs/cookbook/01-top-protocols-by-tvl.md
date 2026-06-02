# Rank the top protocols by TVL

Fetches every protocol DefiLlama tracks and returns the ten largest by current TVL, with the chains each protocol is deployed on. `getProtocols()` returns the full unsorted array, so the sort/slice/projection happens in your `execute()` script — only the small projected result crosses the sandbox boundary.

```js
async function run(defillama) {
  const protocols = await defillama.protocol.getProtocols();
  return protocols
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, 10)
    .map((p) => ({ name: p.name, tvl: p.tvl, chains: p.chains }));
}
```
