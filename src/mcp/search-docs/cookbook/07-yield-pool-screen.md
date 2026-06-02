# Screen yield pools, then drill into one

Filters the full yield-pool universe by minimum TVL and APY, takes the top pools by APY, then fetches the historical APY/TVL series for the single best pool. `getLatestPools()` returns rows under `.data`; each row's `pool` UUID feeds `getHistoricalPoolData`.

```js
async function run(defillama) {
  const { data } = await defillama.yield.getLatestPools();
  const screened = data
    .filter((p) => (p.tvlUsd ?? 0) >= 1_000_000 && (p.apy ?? 0) >= 5)
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
    .slice(0, 5)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      symbol: p.symbol,
      chain: p.chain,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
    }));

  const top = screened[0];
  const history = top
    ? await defillama.yield.getHistoricalPoolData({ pool: top.pool })
    : null;

  return { screened, topPoolHistory: history?.data?.slice(-30) };
}
```
