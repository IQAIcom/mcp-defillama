---
"@iqai/defillama-mcp": patch
---

Chain `pnpm run build` after husky in the `prepare` script so source/git installs end up with a built `dist/`.

This is a **dev-only** change — npm registry consumers are unaffected because the published tarball already ships a pre-built `dist/` and `prepare` doesn't run for tarball installs. The fix matters for anyone installing from a git ref (e.g. `pnpm add github:IQAIcom/mcp-defillama`) or cloning the repo, where `prepare` previously left them without the executable referenced by the `bin` entry. The published package remains bit-for-bit identical to the previous version.

Ported from debank-mcp 7ebd794.
