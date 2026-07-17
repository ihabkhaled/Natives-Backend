# 05 — Delivery Plan

## Workstreams

| ID  | Workstream               | Owner           | Deliverables                                                |
| --- | ------------------------ | --------------- | ----------------------------------------------------------- |
| W1  | Deep audit               | Architect agent | Audit report artifact with concrete findings.               |
| W2  | ESLint hardening         | Architect agent | New custom rules, fixtures, tests, config updates.          |
| W3  | Reference-app tightening | Architect agent | `domain/` layer, service decoupling, constants extraction.  |
| W4  | Governance alignment     | Architect agent | Updated docs, new AI-agent entrypoints, aligned precedence. |
| W5  | Validation               | Architect agent | Green lint, typecheck, tests, coverage, build, format.      |

## Milestones

| Milestone                  | Depends on | Definition of done                                               |
| -------------------------- | ---------- | ---------------------------------------------------------------- |
| M1 Audit complete          | —          | Audit report published and reviewed by the implementing agent.   |
| M2 Docs aligned            | M1         | Governance docs updated and formatted; no contradictions.        |
| M3 ESLint rules added      | M2         | New rules exist with tests and fixtures; lint still passes.      |
| M4 Reference app tightened | M3         | `articles` module demonstrates stricter layering; tests updated. |
| M5 Validation green        | M4         | All quality gates pass.                                          |

## Sequence

1. Format the governance tree so subsequent diffs are clean.
2. Create the feature artifact folder and SDLC phase docs.
3. Inspect the repository and produce the audit report.
4. Update governance docs and add AI-agent entrypoints.
5. Strengthen ESLint rules and add rule tests.
6. Fix the reference-app violations exposed by the new rules and the audit.
7. Unify any duplicated helpers if safe.
8. Run all quality gates and fix any failures.
9. Write final validation and documentation-changelog artifacts.

## Dependencies and blockers

- Node dependencies must be installed (`npm install`).
- No external services or databases are required.
- Husky hooks must remain enabled; no `--no-verify` bypasses.

## Rollout strategy

- Single branch with reviewable commits grouped by workstream.
- No production deployment; the output is a tightened repository state.
- Future feature work will inherit the stricter rules automatically.

## Risk list

| Risk                                           | Likelihood | Impact | Mitigation                                                       |
| ---------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| New ESLint rule has false positives            | Medium     | High   | Add fixtures and tests; run against the whole repo before merge. |
| Formatting commit obscures real changes        | High       | Medium | Make formatting a separate commit before functional changes.     |
| Reference-app tests break after refactor       | Medium     | Medium | Update tests incrementally and run after each change.            |
| Governance docs still contradict after updates | Medium     | Medium | Cross-check every changed file against the canonical precedence. |
