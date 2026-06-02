# Stablecoin market cap by chain

Returns total stablecoin circulating market cap broken down per chain, sorted largest first. `getStablecoinChains()` returns one row per chain; the USD total lives under `totalCirculatingUSD.peggedUSD`.

```js
async function run(defillama) {
  const chains = await defillama.stablecoin.getStablecoinChains();
  return chains
    .map((c) => ({
      chain: c.name,
      circulatingUsd: c.totalCirculatingUSD?.peggedUSD ?? 0,
    }))
    .sort((a, b) => b.circulatingUsd - a.circulatingUsd);
}
```
