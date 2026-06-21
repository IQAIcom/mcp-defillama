---
"@iqai/defillama-mcp": patch
---

Post-`test.yml` cleanup bundle — three small, related fixes:

1. **Logger now defaults to color only on a TTY.** `createLogger`'s `colorize` option previously defaulted to `true` unconditionally, which meant MCP hosts like Claude Desktop (which capture stderr to a non-TTY log file) saw raw ANSI escape codes like `␛[32m`…`␛[39m` in their logs. The new default is `process.stderr?.isTTY === true`, so terminal sessions still get colored output while captured/redirected stderr stays clean. The option remains overridable via `createLogger({ colorize: true })` for callers that want to force color.

2. **Delete `.github/workflows/push.yml`.** After PR #20 added `test.yml`, `push.yml` became a strict subset of it (install → build → lint, all also done by `test.yml`). The two workflows ran in parallel on every push, duplicating ~30s of work each time. Deleting `push.yml` removes the duplication; all CI gating now flows through `test.yml`.

3. **Add a `concurrency:` block to `test.yml`.** Uses `github.head_ref || github.ref` so a PR push's two events (push + pull_request) share a concurrency group and cancel each other instead of running the workflow twice. Also cancels in-flight runs on rebases/force-pushes — saves CI time during iterative review.

No published-artifact change beyond the logger TTY default (which is observable to anyone capturing the server's stderr).
