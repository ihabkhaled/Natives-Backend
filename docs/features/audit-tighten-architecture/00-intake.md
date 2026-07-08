# 00 — Intake: Architecture Audit & Tightening

## Request metadata

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Request ID          | `ARCH-2026-07-08`                                                           |
| Title               | Audit, tighten, and improve the IronNest backend architecture               |
| Type                | Refactor / architecture hardening                                           |
| Source              | Repository owner / senior backend architect                                 |
| Severity            | Medium                                                                      |
| Urgency             | Medium                                                                      |
| Affected domains    | Backend architecture, ESLint governance, documentation, AI-agent onboarding |
| Delivery track      | Standard                                                                    |
| Critical-risk flags | None (no auth, money, privacy, or tenant changes in this pass)              |

## Initial scope statement

Inspect the existing IronNest NestJS backend operating system, document concrete architecture gaps, then apply small, safe, focused improvements:

1. Strengthen the custom ESLint architecture plugin so it can detect more layer-boundary violations.
2. Remove misplaced API-DTO imports from the application layer and move entity creation concerns into the domain layer.
3. Extract remaining magic numbers into constants.
4. Align governance docs (README, claude.md, AGENTS.md, cursor.md, .cursor/rules, rules, skills, context, memory, agents) and add AI-agent entrypoint files for Kimi, Gemini, GLM, Qwen, and DeepSeek.
5. Keep the reference app runnable and all quality gates green.

## Owners

| Role            | Owner                                                |
| --------------- | ---------------------------------------------------- |
| Technical owner | Repository architect                                 |
| Implementation  | AI-assisted delivery agent                           |
| QA              | Automated test suite + lint/typecheck/coverage gates |
| Docs            | Same delivery agent                                  |

## In-scope

- Architecture audit and published report.
- ESLint rule additions and rule tests.
- Reference-app code tightening in `src/modules/articles`.
- Governance doc alignment and new agent entrypoint files.

## Out-of-scope

- New business features.
- New modules or external integrations.
- Authentication/authorization implementation (no auth exists yet; only rules and patterns).
- Database/ORM migration (repository stays in-memory).
- Large rewrites or folder renames.
