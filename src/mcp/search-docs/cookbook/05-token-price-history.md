# Token price history via chain:address

Fetches a historical price chart for a token. The coins API identifies tokens as `${chainSlug}:${tokenAddress}` with a **lowercase** chain slug — use `defillama.resolveChain(input).slug` to build the key (the `.slug` form feeds coins.llama.fi, not the `.name` form). The `tokenAddress` is supplied by the user/caller (from a wallet, an explorer, or a prior on-chain lookup) — there is no DefiLlama-side address discovery. `getPriceChart` returns a series keyed by the same coins identifier under `.coins[key].prices`.

```js
async function run(defillama, { chainInput, tokenAddress }) {
  const chain = await defillama.resolveChain(chainInput); // { name, slug }
  const key = `${chain.slug}:${tokenAddress}`;
  const chart = await defillama.price.getPriceChart({
    coins: key,
    span: 30,
    period: "1d",
  });
  const series = chart.coins?.[key]?.prices ?? [];
  return { coin: key, points: series.length, prices: series };
}
```
