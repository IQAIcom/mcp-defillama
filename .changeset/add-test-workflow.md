---
"@iqai/defillama-mcp": patch
---

Add a `test.yml` GitHub Actions workflow so CI now runs the full test suite, an `isolated-vm` smoke test, and a generated-files drift check on every push and pull request.

Previously the only CI workflow (`push.yml`) ran `install → build → lint`, with no execution of `pnpm test`. PRs could merge green without the 171-test suite ever running in CI — local test runs were the only safety net. The new workflow adds three concrete gates:

- **`pnpm test`** — runs the vitest suite (171 tests today).
- **isolated-vm smoke** — compiles and runs `1 + 1` inside an isolate, catching native-module breakage at install time before the rest of the suite runs.
- **Generated-files diff check** — `git diff --exit-code` against `src/mcp/search-docs/embedded-index.ts` and `src/mcp/instructions/instructions.generated.ts` so the build's regenerated outputs can't drift from what's committed.

No published-artifact change — CI tooling only. Ported (with adapted action versions and generated-file paths) from debank-mcp's `test.yml`.
