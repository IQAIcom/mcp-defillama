# DefiLlama MCP — agent instructions

This server exposes DefiLlama DeFi data through a Code Mode surface. Instead of
one tool per endpoint, you write small JavaScript programs (or invoke endpoints
directly) against a pre-wired `defillama.*` client.

## Tools

Two tools are always available:

- **`execute`** — run sandboxed async JavaScript. Define
  `async function run(defillama) { ... }`; the JSON-serializable return value
  (plus `console.log` output) is sent back. Use this for any multi-step task:
  looping, joining two endpoints, filtering, or shaping a large payload before
  it crosses back. The `defillama` client mirrors the endpoint groups below.
- **`search_docs`** — free-text search over the endpoint catalog and the
  cookbook recipes. Use it first when you're unsure which method or parameters
  you need, or to find a worked recipe.

Four more tools appear only when the server is started with `--tools=dynamic`
(or `DEFILLAMA_MCP_TOOLS=dynamic`):

- **`defillama_resolve`** — resolve a human name to its identifier
  (`{ kind: 'chain' | 'protocol' | 'stablecoin', query }`).
- **`list_endpoints`** — enumerate available endpoints, with an optional keyword filter.
- **`get_endpoint_schema`** — parameters + response JSON Schema for one endpoint.
- **`invoke_endpoint`** — call one endpoint by qualified name, with an optional `jq_filter`.

## Endpoint groups

The `defillama` client (and the catalog) is split into eight groups:

- **`defillama.protocol`** — chains and their TVL, the full protocol list, a
  single protocol's detail, and historical chain TVL.
- **`defillama.dex`** — DEX volume: a single protocol's summary and the
  cross-protocol overview (optionally per chain).
- **`defillama.fees`** — protocol fees and revenue: per-protocol summary and the
  overview (supports a `dataType`, e.g. fees vs. revenue).
- **`defillama.options`** — options-protocol notional/premium volume: per-protocol
  summary and the overview.
- **`defillama.stablecoin`** — stablecoin circulating supply: the stablecoins
  list, per-chain breakdown, historical charts, and current peg prices.
- **`defillama.price`** — token prices: current, first-seen, batch historical,
  historical-at-timestamp, percentage change, and price charts.
- **`defillama.yield`** — yield pools: the latest pool snapshot and a single
  pool's historical APY/TVL chart.
- **`defillama.blockchain`** — block lookup: the block at a given timestamp on a chain.

## Chain identifiers — display name vs. slug

DefiLlama uses two chain spellings depending on the host:

- **api.llama.fi groups** (`protocol`, `dex`, `fees`, `options`) and
  `historical-chain-tvl` use the chain **display name** — `"Ethereum"`.
- **coins.llama.fi calls** (`price`, block-at-timestamp) use the lowercase
  **slug** — `"ethereum"`.

`defillama.resolveChain(x)` returns `{ name, slug }`. Use `.name` for the
api.llama.fi groups and `.slug` for the coins.llama.fi calls. For example:
`const c = await defillama.resolveChain('BSC'); // { name: 'Binance', slug: 'binance' }`
then pass `c.name` to `defillama.dex.getDexsOverview({ chain: c.name })` but
`c.slug` to a `coins.llama.fi` call.

## Discovering IDs — resolve or enumerate, don't guess

DefiLlama's protocol slugs (`aave-v3`), chain display names (`Ethereum`, `BSC`),
and stablecoin IDs (`2`) aren't always derivable from the human-facing name —
versions, separators, and case vary. Don't construct them by lowercasing or
replacing spaces; that's the wrong reflex.

**The rule: resolve or enumerate before invoking.**

1. Try `defillama.resolveProtocol("Aave V3")` / `defillama.resolveChain("BSC")` /
   `defillama.resolveStablecoin("USDC")` first. These match the upstream catalog
   case-insensitively (with substring fallback for chains) and return the
   canonical identifier — or `null` when the input is ambiguous or imprecise.
2. If the resolver returns `null`, enumerate the upstream catalog and filter by
   `name` — e.g. `defillama.protocol.getProtocols()` for protocols. See the
   `find-protocol-slug` cookbook recipe (via `search_docs`) for the worked
   pattern.
3. Read the slug/id off the response — never transform a display name into a
   slug by hand.

## Price coin format — `chain:address`

The `price` group identifies tokens as `${chainSlug}:${tokenAddress}`, where
`chainSlug` is the LOWERCASE chain slug (get it from
`defillama.resolveChain(input).slug`) and `tokenAddress` is the on-chain
contract address (supplied by the user, a wallet, or an explorer — there is
no DefiLlama-side address discovery). Native coins use the `coingecko:` prefix
with a CoinGecko id (e.g. `coingecko:<id>`). Pass multiple comma-separated:

```js
const { slug } = await defillama.resolveChain(input);
const coins = `${slug}:${tokenAddress},coingecko:${nativeCoinId}`;
await defillama.price.getCurrentPrices({ coins });
```

## IQ Gateway vs. direct

If `IQ_GATEWAY_URL` and `IQ_GATEWAY_KEY` are set, upstream calls route through
the IQ Gateway, which adds caching. Otherwise calls go directly to DefiLlama,
with an optional `DEFILLAMA_API_KEY` sent as `x-api-key`. DefiLlama's public API
works unauthenticated, so neither is required.

## Sandbox limits (`execute`)

The sandbox protects DefiLlama's public rate limits (these are not tied to any
user credential):

- a per-invocation **call budget** (default 100 upstream calls),
- a **concurrency cap** (default 10 in-flight calls),
- a **per-call timeout** (5s abort racing a 6s upstream read), and
- a **30s wall-clock** ceiling on the whole script.

Exceeding any of these surfaces as an `{ ok: false, error }` envelope rather
than hanging.

## Choosing a tool

Prefer **`execute`** for anything multi-step — loops, joins across endpoints, or
trimming a large payload before returning. For a single endpoint call, use
**`invoke_endpoint`** with a `jq_filter` to project just the fields you need —
but note `invoke_endpoint` is only available when dynamic tools are enabled
(`--tools=dynamic`); on the default surface, do single calls inside `execute`.
