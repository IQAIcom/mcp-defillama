# Find a protocol's DefiLlama slug

DefiLlama's protocol identifier is a kebab-case slug — `aave-v3`, `uniswap-v3`, `pancakeswap-amm-v3`, `curve-dex` — that's not always a clean transform of the display name. Versions, separators, and category suffixes ("amm", "dex") vary unpredictably between protocols, so guessing wastes calls and burns budget. The fix is always the same shape: try the resolver first, then enumerate the catalog and filter by `name`.

`defillama.resolveProtocol(x)` only matches the **exact** slug/name/symbol (case-insensitive); it returns `null` when the input is ambiguous or imprecise. Use enumerate-and-filter for those cases.

```js
async function run(defillama) {
  // Resolver first — single-call, no upstream. Matches exact names like "Aave V3"
  // (case-insensitive) but won't match a partial like "aave" or a slightly wrong
  // spelling like "aave v3 lending".
  const exact = await defillama.resolveProtocol("Aave V3");
  if (exact) return exact; // -> "aave-v3"

  // Fallback: enumerate. getProtocols() returns the full catalog with each
  // entry's { slug, name, chains, category, tvl, change_1d, change_7d, ... }.
  // The keyword is whatever the user typed; treat it as a fuzzy substring of
  // `name`, never construct the slug yourself.
  const protocols = await defillama.protocol.getProtocols();

  const keyword = "aave";
  const candidates = (protocols || [])
    .filter(p => p && p.name && p.name.toLowerCase().includes(keyword.toLowerCase()))
    .map(p => ({
      slug: p.slug,
      name: p.name,
      chains: p.chains,
      tvl: p.tvl,
    }));

  // Shape: `[{slug, name, chains, tvl}, ...]` — one entry per match. Pick the
  // slug whose `name` matches the version the user asked for. DON'T transform
  // the name into a slug — read `slug` off the response.
  return candidates;
}
```

Once you have the canonical slug, pass it as `protocol` to the per-protocol endpoints:

- `defillama.protocol.getProtocol({ protocol: "aave-v3" })` — TVL + per-chain breakdown
- `defillama.dex.getDexSummary({ protocol: "uniswap-v3" })` — DEX trading volume
- `defillama.fees.getFeesSummary({ protocol: "aave-v3" })` — protocol fees and revenue
- `defillama.options.getOptionsSummary({ protocol: "lyra" })` — options notional volume

**Chains and stablecoins follow the same pattern** with different endpoints and key shapes:

- **Chains:** `defillama.protocol.getChains()` returns `[{ name, tvl, ... }]`. The `name` field (e.g. `"Ethereum"`, `"BSC"`) is what api.llama.fi group endpoints expect; lowercase it for coins.llama.fi calls. See also the `resolve-names` recipe — `defillama.resolveChain(x)` returns both `{ name, slug }` and does substring matching, so the resolver succeeds more often for chains than for protocols.
- **Stablecoins:** `defillama.stablecoin.getStablecoins()` returns `{ peggedAssets: [{ id, name, symbol, ... }] }`. The `id` is a numeric string (e.g. `"2"` for USDC). `defillama.resolveStablecoin("USDC")` does an exact symbol/name match; for fuzzier inputs ("usd-coin", "USD Coin", "Circle"), enumerate the peggedAssets list and filter on `name`/`symbol`.

**Things to know about the slug scheme:**

- Slugs are kebab-case lowercase of the display name with version preserved — `"Aave V3"` → `"aave-v3"`, not `aave_v3`, `aaveV3`, or `aave3`. Spaces become hyphens; punctuation is dropped.
- Category suffixes ("amm", "dex", "lending") are sometimes part of the slug — `"PancakeSwap AMM V3"` → `"pancakeswap-amm-v3"`. Read it off the catalog rather than inferring.
- A protocol with multiple deployed versions has a separate slug per version (`aave-v2`, `aave-v3`, `aave-v4`). The `name` field disambiguates.
- Cross-chain protocols usually have a single slug per major version with all chain deployments rolled up; the `chains` array on the catalog entry lists which chains carry TVL.
- Some chain display names are all-caps (`"BSC"`, `"OP"`); use `getChains()` rather than guessing case.
