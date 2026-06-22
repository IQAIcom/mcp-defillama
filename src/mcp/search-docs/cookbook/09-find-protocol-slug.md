# Find a protocol's DefiLlama slug

DefiLlama's protocol identifier is a kebab-case slug — `aave-v3`, `uniswap-v3`, `pancakeswap-amm-v3`, `curve-dex` — that's not always a clean transform of the display name. Versions, separators, and category suffixes ("amm", "dex") vary unpredictably between protocols, so guessing wastes calls and burns budget. The fix is always the same shape: try the resolver first, then enumerate the catalog and filter by `name`.

`defillama.resolveProtocol(x)` only matches the **exact** slug/name/symbol (case-insensitive); it returns `null` when the input is ambiguous or imprecise. Use enumerate-and-filter for those cases.

```js
async function run(defillama, { protocolInput, keyword }) {
  // Resolver first — single-call, no upstream. Matches the exact catalog
  // display name (case-insensitive) but won't match a partial or a slightly
  // wrong spelling — so it returns null for fuzzy / unversioned inputs.
  const exact = await defillama.resolveProtocol(protocolInput);
  if (exact) return exact; // canonical slug string

  // Fallback: enumerate. getProtocols() returns the full catalog with each
  // entry's { slug, name, chains, category, tvl, change_1d, change_7d, ... }.
  // The keyword is a fuzzy substring extracted from what the user said; never
  // construct the slug yourself — always read it off the response.
  const protocols = await defillama.protocol.getProtocols();

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

Once you have the canonical slug (call it `slug`), pass it through to whichever per-protocol endpoint matches the question:

- `defillama.protocol.getProtocol({ protocol: slug })` — TVL + per-chain breakdown
- `defillama.dex.getDexSummary({ protocol: slug })` — DEX trading volume
- `defillama.fees.getFeesSummary({ protocol: slug, dataType: "dailyRevenue" })` — protocol fees and revenue
- `defillama.options.getOptionsSummary({ protocol: slug })` — options notional volume

Each catalog (DEX, fees, options) is a separate slug namespace — a slug valid in one may not be valid in another (a name like "Uniswap" appears under fees as `uniswap-v2` / `uniswap-v3` / `uniswap-labs` rather than a single unversioned slug). When in doubt, enumerate the per-catalog overview (`getDexsOverview`, `getFeesOverview`, `getOptionsOverview`) and filter `protocols` by `name` to find the slug that lives in that specific catalog.

**Chains and stablecoins follow the same pattern** with different endpoints and key shapes:

- **Chains:** `defillama.protocol.getChains()` returns `[{ name, tvl, ... }]`. The `name` field is what api.llama.fi group endpoints expect (case-sensitive — some chains use Title-Case, some use all-caps tickers); lowercase the same value for coins.llama.fi calls. See also the `resolve-names` recipe — `defillama.resolveChain(input)` returns both `{ name, slug }` and does substring matching, so the resolver succeeds more often for chains than for protocols.
- **Stablecoins:** `defillama.stablecoin.getStablecoins()` returns `{ peggedAssets: [{ id, name, symbol, ... }] }`. The `id` is a numeric string assigned by DefiLlama and not derivable from the symbol. `defillama.resolveStablecoin(symbol)` does an exact symbol/name match; for fuzzier inputs (e.g. a display name that doesn't match either field exactly), enumerate the `peggedAssets` list and filter on `name`/`symbol`.

**Things to know about the slug scheme:**

- Slugs are kebab-case lowercase of the display name with version preserved — `"Aave V3"` → `"aave-v3"`, not `aave_v3`, `aaveV3`, or `aave3`. Spaces become hyphens; punctuation is dropped.
- Category suffixes ("amm", "dex", "lending") are sometimes part of the slug — `"PancakeSwap AMM V3"` → `"pancakeswap-amm-v3"`. Read it off the catalog rather than inferring.
- A protocol with multiple deployed versions has a separate slug per version (`aave-v2`, `aave-v3`, `aave-v4`). The `name` field disambiguates.
- Cross-chain protocols usually have a single slug per major version with all chain deployments rolled up; the `chains` array on the catalog entry lists which chains carry TVL.
- Some chain display names are all-caps (`"BSC"`, `"OP"`); use `getChains()` rather than guessing case.
