# Revise Prompt — IronNest Backend Architecture Tightening

> Use this prompt to launch an agent that revises the existing architecture-tightening work based on a prior audit. The agent must make small, safe, focused fixes and keep every gate green.

## Context

You are revising the IronNest repository at `https://github.com/ihabkhaled/IronNest` (or `/Users/ihab/Desktop/Ihab/IronNest`). The previous work added:

- A `domain/` layer to the `articles` reference module.
- Six ESLint architecture rules: `controller-no-logic`, `no-restricted-layer-imports`, `no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`, `no-cross-module-internal-imports`.
- Rule tests under `test/eslint/architecture-plugin/rules/` for every custom rule.
- New AI-agent entrypoints: `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`.
- Governance updates to align docs with the stricter rules and reconcile `v8` coverage provider/thresholds.
- Fixes for `controller-no-logic` false positives, `process.env` bypasses, `HttpException` message leakage, and explicit `ValidationPipe` options.
- Formatting of the governance tree.

An audit has identified issues. Your job is to fix them without rewriting the architecture, weakening rules, or bypassing quality gates.

## Mandatory pre-revision reading

1. `claude.md` (canonical policy).
2. `AGENTS.md` and the AI-agent entrypoint file for your model family.
3. `docs/features/audit-tighten-architecture/AUDIT_REPORT.md` and any new audit report produced by the audit agent.
4. `context/architecture-map.md`, `rules/00-non-negotiable-rules.md`, the relevant layer rule(s), and the matching skill.
5. The ESLint plugin files: `eslint/architecture-plugin.mjs`, `eslint/architecture.config.mjs`, and the rule files under `eslint/architecture-plugin/rules/`.
6. The reference app code: `src/modules/articles/**/*.ts` and its tests.

## Constraints

- Do **not** rewrite the entire repo or rename folders.
- Do **not** replace the existing architecture.
- Do **not** weaken strict rules to make lint pass.
- Do **not** add `eslint-disable`, `@ts-ignore`, `!`, or `any`.
- Do **not** bypass Husky with `--no-verify`.
- Do **not** skip tests.
- Do **not** create duplicate helper files.
- Do **not** turn `src/shared` into a dumping ground.
- Do **not** leak vendor types into business code.
- Do **not** introduce god services or inline concurrency.
- Make small, reviewable, focused changes. One concern per commit if possible.

## Revision workflow

1. Read the audit findings and classify them by severity.
2. For each finding, reproduce it locally (read the file, run the relevant command, or write a test that fails).
3. Fix the root cause, not the symptom.
4. Update tests and docs in the same stream as the code fix.
5. Run the relevant quality gate after each fix.
6. If a finding is a false positive, explain why and either tune the rule or document the exception. Do not silence the rule.
7. If a finding reveals a new permanent rule, update `claude.md` first, then the mirrors and entrypoints.

## Common fixes you may need to apply

- Move a misplaced constant/type/enum/helper from an implementation file to a dedicated `*.constants.ts`, `*.types.ts`, `*.enums.ts`, or `lib/*.helpers.ts` file.
- Replace a service's API-DTO input type with a model type from `model/*.types.ts`.
- Move entity creation logic from a service to a `domain/*.entity.ts` or `domain/*.factory.ts` file.
- Add defensive pagination defaults/clamping to a repository or DTO.
- Add a missing rule test fixture (valid or invalid) for any custom rule.
- Tighten a rule's file pattern to avoid false positives on mappers/factories/types/constants files or false negatives on class-property arrow handlers.
- Strengthen `process.env` detection to cover computed, destructured, and rebound access.
- Fix `error-body.mapper.ts` so it does not leak `HttpException.message` to clients.
- Add explicit `transformOptions.enableImplicitConversion: false` and `stopAtFirstError: false` to the global `ValidationPipe`.
- Add or fix `no-cross-module-internal-imports` to block private-layer imports across modules.
- Align contradictory wording across governance files (e.g., coverage provider, thresholds, canonical precedence).
- Add missing coverage for a new branch or edge case.
- Extract a repeated helper/algorithm into a named, tested function in the correct module.

## Validation commands

After every meaningful batch of changes, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run format:check
npm run security:scan
```

If any command fails, fix it before continuing. Do not move on with a red gate.

## Deliverable

When revision is complete, produce:

1. A concise summary of the issues fixed, file by file.
2. The validation command results (all green).
3. Any remaining unresolved issues with clear owners and next steps.
4. An updated `docs/features/audit-tighten-architecture/15-dev-validation-report.md` if the validation evidence changed.
5. An updated `docs/features/audit-tighten-architecture/23-documentation-changelog.md` if docs changed.

If no issues were found that need fixing, state that explicitly and point to the evidence that proves the existing work is complete.
