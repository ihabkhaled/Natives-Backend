# Judge Prompt — IronNest Backend Architecture Tightening

> Use this prompt to launch an agent that judges whether the IronNest architecture-tightening work is complete and meets the acceptance criteria. The judge must be impartial, evidence-based, and strict.

## Context

You are judging the IronNest repository at `https://github.com/ihabkhaled/IronNest` (or `/Users/ihab/Desktop/Ihab/IronNest`). A previous agent (or chain of agents) performed an architecture-tightening pass.

Your job is not to implement. Your job is to evaluate whether the work satisfies the original acceptance criteria and the repository's own governance. You must inspect the actual files and run the validation commands. You must be willing to say "not done" if it is not done.

## Mandatory pre-judgment reading

1. `claude.md` (canonical policy).
2. `AGENTS.md` and the AI-agent entrypoint for the model family you are using.
3. `docs/features/audit-tighten-architecture/00-intake.md` through `13-implementation-readiness.md`.
4. `docs/features/audit-tighten-architecture/AUDIT_REPORT.md`.
5. `docs/features/audit-tighten-architecture/15-dev-validation-report.md`.
6. `docs/features/audit-tighten-architecture/23-documentation-changelog.md`.
7. `context/architecture-map.md`, `rules/00-non-negotiable-rules.md`, `rules/01-architecture-and-module-boundaries.md`, `rules/03-application-services-and-use-cases.md`, `rules/04-repositories-and-persistence.md`, `rules/06-types-enums-constants.md`, `rules/11-testing-and-coverage.md`, `rules/12-library-wrapping-and-adapters.md`, `testing/coverage-policy.md`.
8. `eslint/architecture-plugin.mjs`, `eslint/architecture.config.mjs`, and the rule files under `eslint/architecture-plugin/rules/`.
9. `src/modules/articles/**/*.ts` and its tests, plus `src/bootstrap/configure-validation.ts` and `src/core/errors/error-body.mapper.ts`.
10. `test/eslint/architecture-plugin/rules/*.spec.mjs`.

## Judgment criteria

Rate each as **PASS**, **FAIL**, or **N/A**. For any FAIL, provide a concrete finding (file path, line number, snippet, rule violated, fix needed).

### 1. SDLC artifacts

- Do phases `00` through `13` exist in `docs/features/audit-tighten-architecture/`?
- Is there a published audit report with concrete findings and evidence?
- Is there a dev-validation report with command results?
- Is there a documentation changelog?

### 2. AI-agent entrypoints

- Do `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, and `DEEPSEEK.md` exist?
- Do they all include: repo purpose, canonical file precedence, backend architecture, strict layer responsibilities, zero-inline-declaration rule, constants/enums/types placement, controller/service/use-case/repository/adapter rules, security rules, performance rules, readability rules, testing expectations, quality gates, what the agent must never do, how to refactor safely, how to add a feature correctly?
- Are they aligned with `claude.md` and `AGENTS.md`? Is `claude.md` precedence respected?

### 3. Governance alignment

- Do `claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, `.cursorrules`, `.cursor/rules/*.mdc` all reference the new entrypoints and new rules consistently?
- Are there contradictions between any of these files?
- Are `context/architecture-map.md`, `rules/03`, `rules/06`, and `skills/create-service.md` updated to reflect the stricter DTO/model boundary and helper-function rule?

### 4. ESLint plugin

- Are the new rules (`no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`, `no-cross-module-internal-imports`) present and registered?
- Are they configured in `eslint/architecture.config.mjs`?
- Do they have rule tests with valid and invalid fixtures?
- Are the tests integrated into `npm run test`?
- Do the rules have no false positives on legitimate mapper/helper/factory/constants/types files?
- Are existing rules (`controller-no-logic`, `no-restricted-layer-imports`) still intact, and have they been tightened to address false positives/negatives and `process.env` bypasses?

### 5. Implementation-layer violations

- Inspect all `*.controller.ts`, `*.service.ts`, `*.use-case.ts`, `*.repository.ts`, `*.adapter.ts`, guards, interceptors, pipes.
- Are there any misplaced module-level constants, enums, types, interfaces, DTOs, helper functions, or config maps?
- Are there any magic strings or magic numbers in services/use cases/controllers/repos/adapters?
- Are there any services doing too much, importing use cases, or importing API DTOs for input?
- Are controllers thin (one delegation per method)?
- Are repositories persistence-only (no business decisions, no DTO mapping, bounded pagination)?
- Are adapters owning external libraries without leaking vendor types?
- Are there cross-module imports into private implementation layers (`api/`, `application/`, `domain/`, `infrastructure/`)?

### 6. Reference app (`articles`)

- Is there a `domain/` layer that owns entity creation?
- Does the service use model types for input?
- Does the repository use `save(article)` and defensive pagination?
- Are all magic pagination constants extracted?
- Are tests updated and passing? Do they cover the domain factory, service, and repository?

### 7. Security, performance, readability

- Are secure coding rules strengthened in docs and enforced in code?
- Are performance rules strengthened (bounded pagination, no N+1, no inline concurrency, etc.)?
- Are readability rules strengthened (small methods, explicit helpers, named constants, no clever one-liners)?
- Is there any `console.*`, raw `process.env` (including computed/destructured/rebound), unsafe SQL, or secret leakage?
- Does `error-body.mapper.ts` avoid leaking `HttpException.message` to clients?
- Does the global `ValidationPipe` explicitly disable implicit conversion and report all errors (`stopAtFirstError: false`)?

### 8. Validation gates

Run and verify:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run format:check
npm run security:scan
```

All must pass. Report exact output for each.

## Judgment scale

- **PASS**: All criteria are met, all gates are green, no contradictions, no follow-ups.
- **PASS with follow-ups**: Most criteria are met, all gates are green, but there are minor non-blocking improvements to document.
- **CONDITIONAL PASS / NO-GO**: One or more criteria fail, or a gate is red, or there are unaddressed contradictions. The work is not done.

## Deliverable

Produce a judgment report with:

1. Overall verdict: **PASS** / **PASS with follow-ups** / **NO-GO**.
2. Per-criterion scoring table.
3. Concrete findings for any FAIL or follow-up (file, line, snippet, rule, fix).
4. Validation command outputs.
5. List of blockers (if any) that must be fixed before merge/release.
6. Recommended next steps.

Do not be lenient. The repository is meant to be strict. If something is incomplete, say so and explain what is missing.
