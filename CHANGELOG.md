# @iqai/defillama-mcp

## 1.0.1

### Patch Changes

- [#11](https://github.com/IQOfficial/mcp-defillama/pull/11) [`4213936`](https://github.com/IQOfficial/mcp-defillama/commit/42139366d86c72d8f35303558f46ccf748b984e6) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Fail fast with a clear, actionable message when the server is launched under Node < 22 instead of crashing with a cryptic `ReferenceError: File is not defined` from undici. A dependency-free preflight in the bin entry checks the Node version before importing anything that loads undici (the FastMCP wiring moves to `server.ts`), and the README gains a Troubleshooting section covering the absolute-Node-path client config.

## 1.0.0

### Major Changes

- [#6](https://github.com/IQOfficial/mcp-defillama/pull/6) [`8e7f15d`](https://github.com/IQOfficial/mcp-defillama/commit/8e7f15d65ee5a3632284cb5a8a3b107fe5280694) Thanks [@Aliiiu](https://github.com/Aliiiu)! - Refactor to Stainless-style Code Mode. The default tool surface is now `execute` + `search_docs` (the ~19 `defillama_*` endpoint-specific tools are removed; per-endpoint access moves to `invoke_endpoint` under `--tools=dynamic`). The host-side LLM response filter is removed and entity resolution is now deterministic (Gemini/OpenRouter dependencies and their `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `LLM_MODEL` env vars are removed). The `execute` tool runs agent-authored JavaScript in an `isolated-vm` sandbox against a pre-wired `defillama.*` client with per-invocation budget, concurrency, and timeout caps. The ADK `getDefillamaTools()` export moves to the `adk` entry point (`dist/adk/index.js`). Node >= 22 is now required.
