# @iqai/defillama-mcp

## 1.0.4

### Patch Changes

- [#20](https://github.com/IQAIcom/mcp-defillama/pull/20) [`b8e75bb`](https://github.com/IQAIcom/mcp-defillama/commit/b8e75bb5187371c94efa0621a9262ff5c284c095) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Add a `test.yml` GitHub Actions workflow so CI now runs the full test suite, an `isolated-vm` smoke test, and a generated-files drift check on every push and pull request.

  Previously the only CI workflow (`push.yml`) ran `install → build → lint`, with no execution of `pnpm test`. PRs could merge green without the 171-test suite ever running in CI — local test runs were the only safety net. The new workflow adds three concrete gates:

  - **`pnpm test`** — runs the vitest suite (171 tests today).
  - **isolated-vm smoke** — compiles and runs `1 + 1` inside an isolate, catching native-module breakage at install time before the rest of the suite runs.
  - **Generated-files diff check** — `git diff --exit-code` against `src/mcp/search-docs/embedded-index.ts` and `src/mcp/instructions/instructions.generated.ts` so the build's regenerated outputs can't drift from what's committed.

  No published-artifact change — CI tooling only. Ported (with adapted action versions and generated-file paths) from debank-mcp's `test.yml`.

## 1.0.3

### Patch Changes

- [#18](https://github.com/IQAIcom/mcp-defillama/pull/18) [`2ed58da`](https://github.com/IQAIcom/mcp-defillama/commit/2ed58da63ceae71ea0f6d7b9943ee56c343fa9c2) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Drop `--write` from the `lint` script so CI fails on lint violations instead of silently auto-fixing them.

  `pnpm lint` was previously `biome check . --write`, which would fix any auto-fixable issue in place and exit 0 — meaning CI would never surface a lint problem to a PR author. The new `biome check .` exits non-zero on any violation, making `pnpm lint` honest for CI gating.

  Local developers wanting the auto-fix behavior should use `pnpm format` (still `biome format . --write`) or the pre-commit `lint-staged` hook (still `biome check --write`).

  No published-artifact change — this is a dev/CI-only fix. The published package remains bit-for-bit identical.

  Ported from debank-mcp ([`lint: biome check .`](https://github.com/IQAIcom/mcp-debank/blob/main/package.json)).

## 1.0.2

### Patch Changes

- [#16](https://github.com/IQAIcom/mcp-defillama/pull/16) [`b370a41`](https://github.com/IQAIcom/mcp-defillama/commit/b370a412994509a6519cef1b20a6c49556dab1bc) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Plumb a per-method `timeoutMs` override through the execute client so the axios timeout scales with the wrapper deadline.

  `ToolMetadata` gains an optional `timeoutMs?: number` field, and `execute/client.ts` now derives both the wrapper abort timer and the underlying axios timeout from it (`axiosMs = abortMs + AXIOS_BUFFER_MS`, defaulting to 5 s + 1 s = 6 s as before). Without this wiring, a `timeoutMs` override on a direct (non-aggregate) endpoint would be silently no-op'd by the hardcoded 6 s axios timeout — axios would reject before the wrapper budget ever applied.

  No per-method overrides are set in this change; the behavior is bit-for-bit identical to before for every current endpoint (default `abortMs = 5_000`, `axiosMs = 6_000`, error message `"DefiLlama call timed out after 5s: …"`). The change unblocks tuning slow endpoints in follow-up PRs without re-touching the client.

  Ported from debank-mcp 33a17d1 (the equivalent reference fix for the same Code Mode client).

- [#15](https://github.com/IQAIcom/mcp-defillama/pull/15) [`6da05e8`](https://github.com/IQAIcom/mcp-defillama/commit/6da05e82052f0cea35bad6b0e23f38cdaaa6cd69) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Chain `pnpm run build` after husky in the `prepare` script so source/git installs end up with a built `dist/`.

  This is a **dev-only** change — npm registry consumers are unaffected because the published tarball already ships a pre-built `dist/` and `prepare` doesn't run for tarball installs. The fix matters for anyone installing from a git ref (e.g. `pnpm add github:IQAIcom/mcp-defillama`) or cloning the repo, where `prepare` previously left them without the executable referenced by the `bin` entry. The published package remains bit-for-bit identical to the previous version.

  Ported from debank-mcp 7ebd794.

## 1.0.1

### Patch Changes

- [#11](https://github.com/IQAIcom/mcp-defillama/pull/11) [`4213936`](https://github.com/IQAIcom/mcp-defillama/commit/42139366d86c72d8f35303558f46ccf748b984e6) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Fail fast with a clear, actionable message when the server is launched under Node < 22 instead of crashing with a cryptic `ReferenceError: File is not defined` from undici. A dependency-free preflight in the bin entry checks the Node version before importing anything that loads undici (the FastMCP wiring moves to `server.ts`), and the README gains a Troubleshooting section covering the absolute-Node-path client config.

## 1.0.0

### Major Changes

- [#6](https://github.com/IQAIcom/mcp-defillama/pull/6) [`8e7f15d`](https://github.com/IQAIcom/mcp-defillama/commit/8e7f15d65ee5a3632284cb5a8a3b107fe5280694) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Refactor to Stainless-style Code Mode. The default tool surface is now `execute` + `search_docs` (the ~19 `defillama_*` endpoint-specific tools are removed; per-endpoint access moves to `invoke_endpoint` under `--tools=dynamic`). The host-side LLM response filter is removed and entity resolution is now deterministic (Gemini/OpenRouter dependencies and their `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `LLM_MODEL` env vars are removed). The `execute` tool runs agent-authored JavaScript in an `isolated-vm` sandbox against a pre-wired `defillama.*` client with per-invocation budget, concurrency, and timeout caps. The ADK `getDefillamaTools()` export moves to the `adk` entry point (`dist/adk/index.js`). Node >= 22 is now required.
