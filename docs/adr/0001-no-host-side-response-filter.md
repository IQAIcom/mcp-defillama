# ADR 0001 — No host-side response filter

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Aliu Salaudeen
- **Supersedes:** the v0.1 `LLMDataFilter` mechanism (removed on branch `refactor/stainless-style-code-mode`, commit `38b8974`)

## Context

v0.1 of the DefiLlama MCP server returned a single large markdown blob per tool
call. When a response was big enough to overrun the calling LLM's context window,
the server would attempt to re-compress it host-side using a second LLM:

- `BaseService.formatResponse` converted the response to markdown with
  `toMarkdown` (`src/lib/utils/markdown-formatter.ts`), then counted tokens with a
  `js-tiktoken` encoder (`cl100k_base`) against a `config.maxTokens` threshold
  (200 000 tokens).
- If the token count exceeded the threshold AND a `_userQuery` parameter was
  present on the tool call AND an `aiModel` was wired via `OPENROUTER_API_KEY`,
  the method called `LLMDataFilter.filter()` (`src/utils/data-filter.ts`) — an
  LLM that wrote a `jqts` query to compress the raw JSON against the user's
  query, with a first-N-items fallback.
- The trigger inputs (`currentQuery`, `aiModel`) were held as **mutable singleton
  state** on each `BaseService` instance, set via side channels (`setQuery`,
  `setAIModel`). Every one of the 19 tool handlers broadcast `setQuery(q)` to all
  **eight** service singletons before invoking a method, so the filter had query
  context.

The Phase-1 service refactor introduced `*Raw()` methods that return the full
upstream JSON payload: `services` now own transport only, not markdown rendering
or response shaping. Response shaping moves to the agent layer — Code Mode
`execute` (sandbox JS projection) and, in later phases, `invoke_endpoint`'s
`jq_filter` (deterministic `jqts` projection).

This created a question: keep the v0.1 host-side filter for the legacy tool
surface, or delete it?

## Decision

**Delete the host-side response filter entirely.** Services own transport
(`*Raw()`) only. No `LLMDataFilter`, no per-call query state on services, no
`setQuery` / `setAIModel` / `currentQuery` / `aiModel` / `dataFilter` /
`formatResponse`. The `_userQuery` parameter is removed from all 19 legacy tool
schemas. The `OPENROUTER_API_KEY` and `LLM_MODEL` environment variables are no
longer recognized by this server.

When agents need to compress or project a large DefiLlama response, the answer
is agent-authored JS projection in the Code Mode sandbox — or `jq_filter` on
`invoke_endpoint` (Phase 7) for deterministic single-endpoint access.

## Rationale

1. **Host-side filtering requires knowing the agent's intent.** The agent's intent
   is already encoded in the JS it writes inside `execute()`. The host cannot
   out-guess the agent's projection. A host-side filter that "summarises against
   `_userQuery`" is solving a lower-quality version of a problem the agent already
   solves itself.

2. **The reference architecture does not do it.** The reference implementation
   (debank-mcp, which itself models the CoinGecko Stainless MCP shape — see the
   Phase-0 design spec) has no host-side response filter; it relies entirely on
   Code Mode for response shaping (spec §2.2, delta D4/D5).

3. **The filter was already inert for most tool calls.** All 19 tools wrote
   hand-projected, top-N-sliced markdown (`top-20 chains`, `top-10 protocols`,
   `essential fields`). The tiktoken check rarely tripped because the host-side
   projection already reduced size. The filter only provided a second layer of
   compression in edge cases — cases the sandbox's JS projection handles cleanly
   and with full agent control.

4. **The mutable singleton state was a real bug source.** The `currentQuery`
   lived as instance state on each of the eight service singletons. A query leaked
   from tool call N would silently filter tool call N+1's response against the
   wrong context. The fix required a `setQuery("")` clear-broadcast in every code
   path — a fragile invariant. Deleting the state deletes the bug class: no
   clear-broadcast needed, no leak possible (spec §1.4).

5. **The deletion is clean.** Removing the filter eliminates two dependencies
   (`@openrouter/ai-sdk-provider`, `js-tiktoken`), two env vars
   (`OPENROUTER_API_KEY`, `LLM_MODEL`), one integration module
   (`src/lib/integrations/openrouter.ts`), one utility module
   (`src/utils/data-filter.ts`), and the `toMarkdown` formatter
   (`src/lib/utils/markdown-formatter.ts`). No caller has to compensate; no
   compensating logic was added elsewhere.

## Consequences

### Gained

- `BaseService` is now a pure transport primitive: `fetchData` → typed JSON,
  optionally routed through the IQ Gateway; no singleton state, no async filter
  detour. Easier to reason about and to test.
- Filtering-related machinery removed: `LLMDataFilter`, `openrouter` integration,
  `Tiktoken` encoder, `markdown-formatter`, two removed env vars, two removed
  package dependencies.
- The mutable-singleton-state bug class is deleted. No more `setQuery` /
  `setAIModel` broadcasts, no more `_userQuery` plumbing through 19 tool schemas,
  no more risk of cross-call query leakage across the eight service singletons
  (`protocol`, `dex`, `fees`, `stablecoin`, `price`, `yield`, `options`,
  `blockchain`).
- `src/services/index.ts` is now side-effect-free at module load: no
  `openrouter()` call, no `setAIModel` wiring.
- Services span four upstream hosts (`api`, `coins`, `stablecoins`, `yields`
  `.llama.fi`); each is now a clean transport layer with no cross-cutting filter
  state.

### Lost

- **Callers who passed `_userQuery` on large responses lose silent compression.**
  Migration path: use Code Mode `execute` with agent-authored JS projection for
  multi-step flows, or (Phase 7) `invoke_endpoint` with a `jq_filter` for
  deterministic single-endpoint projection.
- The 19 legacy `defillama_*` tools are themselves scheduled for removal in Phase
  8. Per-endpoint access will go through `invoke_endpoint` (qualified name from
  `list_endpoints`, optional `jq_filter` — the deterministic replacement for the
  v0.1 LLM filter).

## When to revisit

This ADR should be reopened **only if**:

- Code Mode (`execute`) itself fails to address response-size shaping for a new
  tool surface that genuinely cannot use the sandbox.
- A response-size problem arises that the agent provably cannot solve via
  projection (e.g. streaming results, multi-step pagination where the agent's
  first call already exceeds context before any projection is possible).

If filtering is ever needed again, the right architectural location is **the tool
layer**, not `BaseService`. Tool handlers are where `_userQuery`-equivalent
inputs would originate as MCP parameters; co-locating the filter with its trigger
keeps locality intact. `BaseService` should remain a pure transport primitive
regardless.

## Related

- Design spec: `docs/superpowers/specs/2026-06-01-stainless-style-refactor.md`
  — §1.2 (host-side filter mechanism), §1.4 (mutable singleton state), §2.2
  delta table D4/D5 (response shaping decision, query plumbing deletion)
- Phase-1 service refactor commit: `38b8974` — `refactor!: services return full
  JSON via *Raw(); rewire legacy tools; drop host-side filter + deps`
  (branch `refactor/stainless-style-code-mode`)
