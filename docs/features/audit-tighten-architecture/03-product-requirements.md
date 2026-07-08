# 03 — Product Requirements

## Epics

| Epic                        | Description                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| E1 Audit                    | Produce a concrete, evidence-based audit report of the current architecture state. |
| E2 ESLint hardening         | Add custom architecture rules and tests that close the enforcement gaps.           |
| E3 Reference-app tightening | Fix the small layer violations found in `src/modules/articles`.                    |
| E4 Governance alignment     | Align governance docs and add missing AI-agent entrypoint files.                   |
| E5 Validation               | Run all quality gates and prove they remain green.                                 |

## User stories

1. As an AI agent, I want a dedicated entrypoint file for my model family so that I know the canonical policies and architecture without reading conflicting files.
2. As a reviewer, I want ESLint to reject services that import API DTOs so that the application layer stays independent of the HTTP boundary.
3. As a contributor, I want the reference app to show a `domain/` layer so that I know where to put business rules.
4. As a maintainer, I want all governance docs to agree on file precedence and layer responsibilities so that contradictions do not confuse contributors.
5. As a quality gate, I want every custom ESLint rule to have valid and invalid fixtures so that regressions are caught.

## Acceptance criteria

- [ ] Audit report lists at least five concrete findings with file paths and line numbers.
- [ ] `npm run lint` passes with 0 errors and 0 warnings after changes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run test:coverage` meets thresholds on touched modules.
- [ ] `npm run build` passes.
- [ ] `npm run format:check` passes.
- [ ] At least one new ESLint rule is added with invalid and valid fixtures and tests.
- [ ] `src/modules/articles` contains a `domain/` layer file that owns entity creation.
- [ ] Services in the reference app do not import API DTOs.
- [ ] README.md, claude.md, AGENTS.md, cursor.md, codex.md, .cursorrules, and .cursor/rules are mutually aligned.
- [ ] KIMI.md, GEMINI.md, GLM.md, QWEN.md, and DEEPSEEK.md exist and follow the same canonical structure.

## In-scope

- Architecture audit report.
- ESLint rule additions and tests.
- Reference-app refactor to demonstrate stricter layering.
- Governance doc updates and new agent entrypoints.
- Formatting of the governance tree.

## Out-of-scope

- New features, new modules, new integrations.
- Runtime authentication/authorization wiring.
- Database or ORM migration.
- Performance benchmarking or load testing.

## Non-goals

- Replace the existing architecture.
- Rename existing folders.
- Introduce a new framework or ORM.
- Add eslint-disable or bypass Husky.
