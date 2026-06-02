# Correlate a block at a timestamp with historical chain TVL

Resolves the block closest to a given timestamp, then pulls the historical TVL series for the same chain so you can correlate on-chain state with TVL. Note the two host conventions: `getBlockAtTimestamp` is a coins.llama.fi call and wants the **lowercase slug** (`chain.slug`), while `getHistoricalChainTvl` is an api.llama.fi call and wants the **display name** (`chain.name`).

```js
async function run(defillama) {
  const chain = await defillama.resolveChain("Ethereum"); // {name:"Ethereum", slug:"ethereum"}
  const timestamp = 1700000000;

  const block = await defillama.blockchain.getBlockAtTimestamp({
    chain: chain.slug,
    timestamp,
  });
  const tvl = await defillama.protocol.getHistoricalChainTvl({
    chain: chain.name,
  });

  return {
    height: block.height,
    blockTimestamp: block.timestamp,
    tvlPoints: tvl.length,
    latestTvl: tvl[tvl.length - 1],
  };
}
```
