# DEX volume leaderboard for a chain

Builds a leaderboard of the highest-volume DEXs on a single chain using 24h volume. `getDexsOverview` expects the chain **display name** for api.llama.fi — use `defillama.resolveChain(chainInput).name` to turn a user-supplied alias (anything from "eth" to "Ethereum") into the canonical display name first. The DEX rows live under `.protocols`.

```js
async function run(defillama, { chainInput }) {
  const chain = await defillama.resolveChain(chainInput); // { name, slug }
  const overview = await defillama.dex.getDexsOverview({ chain: chain.name });
  return (overview.protocols ?? [])
    .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
    .slice(0, 10)
    .map((d) => ({ name: d.name, volume24h: d.total24h }));
}
```
