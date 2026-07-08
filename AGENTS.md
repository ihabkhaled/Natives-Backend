# AGENTS.md

This file is the Codex-compatible bootstrap for this repository.

`claude.md` is the canonical long-form operating policy. Before doing analysis, planning, implementation, review, release work, or documentation work, read `claude.md` fully and follow it as binding company policy.

If this file, `codex.md`, `cursor.md`, `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`, `.cursor/rules/`, or `.cursorrules` ever differ from `claude.md`, `claude.md` wins unless another file is temporarily stricter for safety.

## Repository Purpose

This repository is a generic enterprise SDLC operating system meant to work across:

- any programming language
- any framework
- any architecture style
- any company environment
- any product maturity level

The goal is to force complete, explicit, production-grade software delivery instead of shallow "make it work" behavior.

## Mandatory First Actions

Before changing anything:

1. Read `claude.md`.
2. Read the relevant request artifacts under `docs/features/<feature-slug>/` if they exist.
3. Read the relevant baseline docs under `docs/sdlc/`.
4. Read the code and tests you are going to touch before editing them.
5. Read architecture docs, ADRs, runbooks, or release notes when the change affects them.

No one should modify code they have not read.

## Canonical Operating Rules

1. Never skip phases.
2. Never jump directly to implementation.
3. No implementation starts before phases `00` through `13` are documented.
4. Depth may scale by request size, but phase existence and gates never disappear.
5. Every request must write artifacts.
6. Every permanent new rule must update `claude.md`.
7. Prefer small, reviewable changes over giant opaque changes.
8. Tests and documentation must be updated in the same delivery stream as behavior changes.
9. Coverage is measured on touched modules, not only on global repository averages.
10. No change is done unless it is reviewed, tested, secure, observable, documented, and reversible.

## Mandatory SDLC Shape

Every request must move through the full lifecycle defined in `claude.md`, including:

- intake
- business analysis
- commercial impact
- product requirements
- cross-functional refinement
- delivery planning
- technical refinement
- technical roadmap
- architecture review
- impact analysis
- engineering standards review
- test strategy
- coverage plan
- implementation readiness
- implementation
- developer validation
- internal bug loop
- QA validation
- QA defect loop
- security review
- UAT
- client approval where required
- go / no-go governance
- documentation updates
- risk / compliance / ops review
- release
- hypercare
- retrospective and postmortem

## Artifact Locations

Use these locations consistently:

- `docs/sdlc/` for permanent baseline policy
- `docs/features/<feature-slug>/` for request-specific phase artifacts
- `test-cases/` for reusable detailed test cases
- `architecture/adrs/` for architecture decisions
- `runbooks/` for operator procedures
- `release-notes/` for release communication
- `support/` for support-facing guidance

## Non-Negotiable Gates

Do not proceed when any of the following is true:

- phases `00` through `13` are incomplete
- tests are missing for changed behavior
- docs are stale for changed behavior
- touched-module coverage is below threshold without waiver
- lint, static analysis, type, build, test, or security checks are failing
- architecture impact is undocumented
- rollback is undefined
- observability, monitoring, or alerts are undefined for material risk
- QA sign-off is missing for release
- security sign-off is missing when applicable
- go / no-go approval is missing for release

## Engineering And Quality Expectations

Follow the generic quality rules from `claude.md`, including:

- keep transport layers thin
- keep business logic out of UI and transport layers
- keep persistence logic in dedicated persistence ownership
- do not leave reusable types, enums, constants, schemas, or policy maps inline in logic-heavy or presentation-heavy files
- wrap important third-party libraries behind local reusable modules
- document shared/common modules so future work reuses them instead of bypassing them
- keep methods small, explicit, and reviewable
- make async workflows observable, bounded, and failure-aware
- validate at trust boundaries
- never leak secrets or sensitive data

## Testing, DevOps, And Release Expectations

Always enforce:

- clear test strategy before implementation
- deterministic automated validation where practical
- QA evidence and repeatable validation harnesses for meaningful workflows
- environment, config, migration, backfill, and rollback planning before release
- CI/CD parity with authoritative local commands
- pre-commit, pre-push, and commit-message discipline where configured
- runbook, monitoring, dashboard, support, and release-note updates for operational changes

## Required Response Order For Requests

When handling a request, respond and work in this order:

1. Request classification
2. Assumptions
3. Phase tracker
4. Summary of the current request
5. Business analysis
6. Product requirements
7. Architecture and impact analysis
8. Engineering standards review
9. Test strategy and coverage plan
10. Delivery plan and technical roadmap
11. Documentation plan
12. Risks and blockers
13. Only then implementation or code work if appropriate

## Tool Compatibility Notes

- `claude.md` is canonical.
- `codex.md` and `cursor.md` are mirrors/reference copies.
- `.cursor/rules/*.mdc` is the active Cursor ruleset.
- `.cursorrules` exists only for legacy Cursor compatibility.

## AI Agent Entrypoints

In addition to `claude.md` (canonical) and `AGENTS.md` (Codex bootstrap), the repository provides dedicated entrypoints for major AI agent families:

- `KIMI.md` — Kimi-family agents (e.g., Moonshot Kimi).
- `GEMINI.md` — Gemini-family agents (e.g., Google Gemini).
- `GLM.md` — GLM-family agents (e.g., Zhipu ChatGLM).
- `QWEN.md` — Qwen-family agents (e.g., Alibaba Qwen).
- `DEEPSEEK.md` — DeepSeek-family agents (e.g., DeepSeek-V3 / DeepSeek-Coder).

Each entrypoint restates the canonical file precedence, the NestJS backend architecture, the zero-inline-declaration rule, layer responsibilities, security/performance/readability expectations, testing gates, and what the agent must never do. If an entrypoint contradicts `claude.md`, `claude.md` wins.

## NestJS Engineering Operating System

`claude.md` is the stack-agnostic governance brain (which phases/gates apply). For any **NestJS backend** work, a concrete engineering operating system defines exactly how the code must be written, and it is mechanically enforced by `eslint.config.mjs` (with a custom architecture plugin under `eslint/`), `tsconfig.json`, and the Husky hooks in `.husky/`:

- `rules/` — layer-by-layer engineering rules; start with `rules/00-non-negotiable-rules.md`.
- `skills/` — step-by-step task playbooks that apply the rules.
- `context/` — `context/architecture-map.md` (canonical architecture), `context/stack-and-toolchain.md`, `context/codebase-navigation.md` (task router), `context/reference-patterns.md` (copy-ready code).
- `memory/` — durable decisions + `memory/known-pitfalls.md`.
- `agents/` — specialist review roles.
- `testing/` — engineering test standards.

Canonical architecture (one-way layered deps): Controller (`api/*.controller.ts`, thin, one delegation/method) → Application (`application/*.use-case.ts` for orchestration+transactions; `*.service.ts` focused, ≤20 lines/method) → Domain (`domain/`) → Persistence (`infrastructure/*.repository.ts`) → Integration (`adapters/*.adapter.ts`). Cross-cutting in `src/core`, `src/config`, `src/shared`.

Before NestJS implementation read: `claude.md` → `context/architecture-map.md` → `rules/00-non-negotiable-rules.md` → the layer rule(s) and the matching skill. Then write tests first and keep every gate green: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`. If engineering guidance ever conflicts with `claude.md`, `claude.md` wins; when two rules overlap, the stricter one applies.

## Final Instruction

Treat this repository as a strict enterprise workflow, not a suggestion. Read `claude.md`, follow it in full, and do not compress away the work that makes software production-ready.
