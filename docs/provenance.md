# Provenance and upstream-sync policy

## Origin

`Natives-Backend` is the backend for the **Ultimate Natives** application. It is derived from the
strict **IronNest** NestJS engineering operating system.

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| Template             | IronNest                                                       |
| Template remote      | `upstream-template` → `https://github.com/ihabkhaled/IronNest` |
| Template commit      | `7d63b79d972332da3642731cda1f79426db79d80` (branch `main`)     |
| Bootstrap date       | 2026-07-17                                                     |
| Destination `origin` | `git@github.com:ihabkhaled/Natives-Backend.git`                |

The initial repository commit is preserved as an ancestor of `main`; the template baseline was merged
in with `--allow-unrelated-histories` so full template history remains reachable.

## Remote policy

- `origin` — the destination repository; the only push target.
- `upstream-template` — read-only source of the IronNest baseline. Its push URL is disabled
  (`DISABLED_NO_PUSH_TEMPLATE`) so the template can never be an accidental push destination.

## Upstream sync

The template is not tracked for continuous merges. When adopting an upstream improvement, cherry-pick or
merge the specific change from `upstream-template`, re-run every inherited gate, and record it here. The
inherited architecture, ESLint, coverage, security, and knowledge gates must never be weakened to adopt a
change.

## Baseline gate evidence (template, before product code)

All local gates GREEN on the bootstrap commit: `format:check`, `lint`, `typecheck`,
`test:coverage` (99.6% statements / 94.93% branches / 100% functions), `build`,
`knowledge:check`, `knowledge:verify`, `security:audit` (0 vulnerabilities). `security:scan` (trivy
0.71.0) available locally. See the workspace execution ledger for full command output.
