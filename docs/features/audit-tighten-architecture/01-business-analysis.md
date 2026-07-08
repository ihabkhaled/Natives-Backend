# 01 — Business Analysis

## Problem statement

The IronNest repository is a generic enterprise SDLC operating system for NestJS backends. It ships with a strong governance layer, a custom ESLint architecture plugin, and a small reference app. Over time, small inconsistencies can appear between the written rules and the mechanical enforcement, and the reference app can drift from the stated architecture. The risk is that future AI-assisted or human contributors receive contradictory signals and start bypassing the architecture.

## Stakeholders

| Stakeholder                         | Interest                                                    |
| ----------------------------------- | ----------------------------------------------------------- |
| Repository owner / senior architect | Keep the rulebook and the codebase aligned and credible.    |
| Future AI agents                    | Have a single, unambiguous set of entrypoint instructions.  |
| Future human contributors           | Understand the exact architecture and why each file exists. |
| Consumers of the reference app      | See the architecture in practice, not just in theory.       |

## Current state

- Governance docs exist and are comprehensive (`claude.md`, `AGENTS.md`, `rules/`, `skills/`, `context/`, etc.).
- Custom ESLint plugin enforces two architecture rules (`controller-no-logic`, `no-restricted-layer-imports`) plus `no-restricted-syntax` and `max-lines-per-function`.
- Reference app (`articles` module) is small and mostly clean, but imports API DTOs into the service and generates entity metadata in the service layer.
- No AI-agent entrypoint files exist for Kimi, Gemini, GLM, Qwen, or DeepSeek.
- Formatting was not fully applied across the governance tree.

## Desired state

- The ESLint plugin is large enough to detect the violations described in the architecture docs.
- The reference app demonstrates every layer of the architecture (including a small `domain/` layer).
- Governance docs are mutually consistent and cover the stricter rules requested.
- Every major AI agent family has a dedicated entrypoint file.
- All quality gates pass with zero errors and zero warnings.

## Success metrics

1. `npm run lint` 0 errors, 0 warnings.
2. `npm run typecheck` passes.
3. `npm run test` 100% passes.
4. `npm run test:coverage` meets thresholds (≥95% lines/functions/statements, ≥90% branches).
5. `npm run build` passes.
6. `npm run format:check` passes.
7. New ESLint architecture rule tests exist and pass.
8. No new `process.env` reads outside `config/`/`bootstrap/`.
9. No new vendor imports outside adapters/owners.

## Assumptions

- The repository stays a reference implementation, not a production system.
- The in-memory `ArticleRepository` remains acceptable for the reference app.
- No auth/permissions guards are required for this scope (the architecture patterns are documented but not yet wired).

## Dependencies

- Node ≥20, npm ≥10.
- Existing ESLint 9 + `typescript-eslint` toolchain.
- Existing Vitest test harness.

## Risks of not doing the work

- Layer boundaries erode as future contributors copy the existing reference app.
- AI agents receive inconsistent instructions across entrypoint files.
- The custom ESLint plugin falls behind the written rules, making the rules aspirational rather than enforced.
