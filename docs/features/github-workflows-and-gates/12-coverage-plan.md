# 12 — Coverage Plan

## Touched executable surfaces

- `package.json` test/security entrypoints
- GitHub workflow control flow
- Dependabot configuration

## Thresholds

Application coverage remains statements/functions/lines `>=95%` and branches `>=90%`. No production TypeScript behavior changes.

## CI configuration coverage

YAML is not instrumented by Vitest. Review coverage is scenario-based:

- all three triggers
- least-privilege permissions
- concurrency cancellation
- Node/cache/bootstrap
- exact authoritative command
- timeout
- failure remains blocking
- backend E2E without Playwright
- SARIF generation/upload

## Waiver

No threshold waiver. GitHub-hosted execution cannot occur before files are pushed; first remote-run evidence is explicitly deferred until owner approval and push.
