---
"@iqai/defillama-mcp": major
---

Refactor to Stainless-style Code Mode. The default tool surface is now `execute` + `search_docs` (the ~19 `defillama_*` endpoint-specific tools are removed; per-endpoint access moves to `invoke_endpoint` under `--tools=dynamic`). The host-side LLM response filter is removed and entity resolution is now deterministic (Gemini/OpenRouter dependencies and their `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `LLM_MODEL` env vars are removed). The `execute` tool runs agent-authored JavaScript in an `isolated-vm` sandbox against a pre-wired `defillama.*` client with per-invocation budget, concurrency, and timeout caps. The ADK `getDefillamaTools()` export moves to the `adk` entry point (`dist/adk/index.js`). Node >= 22 is now required.
