# 11 — Test Strategy: Simple Readable Code Operating System

## Requirement-to-test mapping

| Requirement                                                            | Validation                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| New simplicity lint caps active with expected options                  | `test/eslint/config-rule-activation.spec.mjs` — per-rule severity + options assertions                              |
| Dead overrides revived (inline decls, adapter concurrency, domain DTO) | Same spec — resolved-config assertions per representative path (service/controller/repository/adapter/guard/domain) |
| Test relaxations NOT accidentally re-enabled                           | Same spec — spec-file assertions (`max-lines-per-function` off, `no-explicit-any` still error)                      |
| `lib/` files not misclassified as implementation layers                | Same spec — negative assertion                                                                                      |
| Existing behavior unchanged (incl. `verifyPassword` relocation)        | Entire existing Vitest suite must pass unchanged; auth login specs exercise real bcrypt hashing                     |
| Whole codebase satisfies the stricter caps                             | `npm run lint` 0/0 across the repo                                                                                  |
| Docs/rules/skills internally consistent                                | Adversarial verification sweep (link + consistency + no-weakening review) before completion                         |

## Test layers used

- **Unit (config):** ESLint `calculateConfigForFile` assertions (new spec, 24 cases).
- **Unit/integration (existing):** full suite re-run — services, repositories, domain, guards, filters, plugin RuleTester specs.
- **E2E (existing):** `test/app.e2e-spec.ts` boots the app — proves the governance change did not touch runtime wiring.
- **Static:** lint (all new rules), typecheck (`tsgo`), build, Trivy security scan, `format:check` after LF normalization.

## Negative and edge cases

- Spec file paths must keep relaxations (negative case in the config spec).
- `lib/` path must NOT trigger layer rules (negative case).
- Renormalization must produce zero content diffs (verified via `git diff --numstat` = intended files only).

## Migration and rollback tests

Not applicable — no schema or data change. Accepted by: repository architect.

## Environments and evidence

Local Windows 11 working copy, Node ≥ 20, npm ≥ 10; evidence = command outputs recorded in `15-dev-validation-report.md`.
