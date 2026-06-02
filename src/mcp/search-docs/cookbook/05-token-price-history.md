# Token price history via chain:address

Fetches a historical price chart for a token. The coins API identifies tokens as `{chainSlug}:{address}` with a **lowercase** chain slug — use `defillama.resolveChain(...).slug` to build the key (the `.slug` form feeds coins.llama.fi, not the `.name` form). `getPriceChart` returns a series keyed by the same coins identifier under `.coins[key].prices`.

```js
async function run(defillama) {
  const chain = await defillama.resolveChain("Ethereum"); // {name, slug:"ethereum"}
  const key = chain.slug + ":0xdac17f958d2ee523a2206206994597c13d831ec7"; // USDT
  const chart = await defillama.price.getPriceChart({
    coins: key,
    span: 30,
    period: "1d",
  });
  const series = chart.coins?.[key]?.prices ?? [];
  return { coin: key, points: series.length, prices: series };
}
```
