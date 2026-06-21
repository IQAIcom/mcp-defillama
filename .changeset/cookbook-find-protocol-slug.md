---
"@iqai/defillama-mcp": patch
---

Add an "ID discovery" instruction + a `find-protocol-slug` cookbook recipe so agents stop guessing protocol slugs when the resolver returns null.

`defillama.resolveProtocol` and `defillama.resolveStablecoin` only do exact case-insensitive matches on slug/name/symbol — when an agent passes an imprecise input like `"aave"` (no version), `"USD Coin"` vs `"usd-coin"`, or a partial like `"pancake"`, the resolver returns `null`. Without an upfront discovery path, the agent's reflex is to construct a slug by hand (`aave_v3`, `usd_coin`, `pancakeswap_v3`) — DefiLlama's slug scheme doesn't match any of those, so the call fails and the agent burns budget retrying variants.

Two coordinated additions:

- **`src/mcp/instructions/instructions.md`** — new always-loaded section "Discovering IDs — resolve or enumerate, don't guess" between "Chain identifiers" and "Price coin format". States the rule (resolve first, fall back to enumerate, never transform a display name into a slug) and points at the cookbook recipe.
- **`src/mcp/search-docs/cookbook/09-find-protocol-slug.md`** — a worked recipe showing the resolver-first / enumerate-and-filter fallback on `defillama.protocol.getProtocols()`. Covers protocol-slug discovery in depth and notes how the same shape applies to chains (`getChains()`) and stablecoins (`getStablecoins().peggedAssets`). Existing `08-resolve-names.md` links to it for the "resolver returned null" case.

No fixed lookup table baked into the always-loaded instructions — that would be the cheat-sheet anti-pattern. The cookbook is the right surface: loaded on demand via `search_docs`, not on every session.

Inspired by debank-mcp's [`find-protocol-id` recipe](https://github.com/IQAIcom/mcp-debank/blob/main/src/mcp/search-docs/cookbook/11-find-protocol-id.md) and the [ID-discovery instruction](https://github.com/IQAIcom/mcp-debank/commit/73dfce2) that ships alongside it.
