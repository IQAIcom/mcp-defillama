---
"@iqai/defillama-mcp": patch
---

Drop `--write` from the `lint` script so CI fails on lint violations instead of silently auto-fixing them.

`pnpm lint` was previously `biome check . --write`, which would fix any auto-fixable issue in place and exit 0 — meaning CI would never surface a lint problem to a PR author. The new `biome check .` exits non-zero on any violation, making `pnpm lint` honest for CI gating.

Local developers wanting the auto-fix behavior should use `pnpm format` (still `biome format . --write`) or the pre-commit `lint-staged` hook (still `biome check --write`).

No published-artifact change — this is a dev/CI-only fix. The published package remains bit-for-bit identical.

Ported from debank-mcp ([`lint: biome check .`](https://github.com/IQAIcom/mcp-debank/blob/main/package.json)).
