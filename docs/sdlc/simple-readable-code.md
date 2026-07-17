# Simple Readable Code Baseline

## Purpose

This document is the permanent company baseline for code simplicity and readability. It defines what "simple" means here, how it is enforced, and where its boundaries are. The stack-specific canon lives in `rules/20-simple-readable-code.md` through `rules/30-declaration-ownership.md`; this baseline states the standing policy every request-specific feature folder inherits.

## The Principle

The best backend code is the code the next developer understands immediately.

Code should look like it was written by a calm senior engineer for a team of mixed experience levels. It must not look like a code-golf contest, a framework demo, a TypeScript trick showcase, an AI-generated abstraction factory, a "future-proof" architecture for imaginary requirements, or a 500-line service only its author understands.

The goal is not fewest lines at any cost. The goal is:

> Write only what the task needs, in the clearest possible way, while keeping security, validation, architecture, tests, observability, message-key i18n, and reliability fully intact.

## The Two Bars

- **Junior-readable** — a junior engineer can follow the flow top to bottom without archaeology.
- **Senior-trustworthy** — a senior engineer can trust the boundaries (layers, validation, guards, bounds, error mapping) without re-deriving them.

Every merged change must clear both bars. Reviewers verify them with the nineteen questions in `rules/24-team-readable-code-review.md`.

## The Simple Code Ladder

Before writing new code — after reading the touched code, never instead of it:

1. Does this code need to exist? If no, do not write it.
2. Does the codebase already have this? Search existing modules, shared code, core, config, rules, skills, memory, tests. Reuse or extend the owner.
3. Does Node.js, TypeScript, NestJS, or the platform already solve it? Use the native solution.
4. Does an already-approved dependency solve it through an existing adapter? Use the adapter.
5. Can this be a small pure helper? Place it with the correct owner.
6. Can the solution be direct and readable? Write the direct readable version.
7. Only then create a new abstraction — with a real current reason: repeated use, layer boundary, external adapter, security isolation, transaction boundary, or testability.

The ladder never skips investigation, tests-first, docs, strict typing, lint, DTO validation, auth/permission/ownership checks, typed errors with message keys, repository bounds, adapter wrapping, observability, or security review.

## What Minimalism Never Cuts

Deleting or skipping any of the following is not simplicity — it is a policy violation and an automatic review blocker:

- input validation at the boundary
- authentication, authorization, and ownership/tenant checks
- typed errors with message keys
- adapter wrapping of external libraries
- parameterized queries and pagination bounds
- configuration validation and the logger adapter
- observability on critical paths
- tests and documentation shipped with the change

## Anti-Patterns

- nested ternaries, dense one-liners, long chained transformations
- clever TypeScript: unreadable conditional types, over-generic one-use helpers, cast chains
- speculative abstractions: plugin systems, base classes, factories, strategies, buses, queues, caches without a current requirement
- parallel duplicates of constants, validators, query helpers, error mapping, or permission logic
- pass-through services and meaningless tiny files created to satisfy line-count fashion
- comments that explain unclear code instead of fixing it
- token-burning output: huge diffs, boilerplate repetition, needless wrappers/mocks/snapshots, duplicated policy text across documents

## How It Is Enforced

- Mechanically: `complexity` ≤ 15, `sonarjs/cognitive-complexity` ≤ 15, `max-depth` ≤ 3, `no-nested-ternary`, service methods ≤ 20 lines, conservative budgets on other implementation methods, no inline/anonymous layer contracts, no DTO definite-assignment assertions, one class per layer file, plus package boundaries (see `rules/13-eslint-and-typescript.md`).
- By procedure: the indexed simplicity and cleanup skills in `skills/`, especially `full-codebase-cleanup.md`, `refactor-inline-declarations.md`, and the focused security/validation cleanup playbooks.
- By review: section 2a of `rules/15-review-checklist.md` and the readability questions of `rules/24-team-readable-code-review.md`.
- By record: durable rationale in `memory/code-simplicity-decisions.md`, refactor/agent/security/validation decision files, and recurring traps in `memory/known-pitfalls.md`.

## AI Agent Behavior

AI agents follow the same ladder, stated compactly in every agent entrypoint:

> Before writing code, run the Simple Code Ladder: need it → reuse existing → native/platform → existing adapter/dependency → small helper → direct readable code → new abstraction only when justified. Be lazy about code volume, never lazy about reading, validation, security, auth, permissions, ownership checks, tests, docs, observability, or architecture.

Agents must not over-produce: no speculative scaffolding, no restated policy bodies in mirrors, no oversized diffs, no tests for behavior that does not exist. Overbuilt AI output is corrected with `skills/simplify-existing-code.md` and `skills/remove-unnecessary-code.md`.

## How To Simplify Overbuilt Code

1. Pin current behavior with characterization tests first.
2. Identify real responsibilities; delete dead and speculative code.
3. Rename for domain clarity; extract pure helpers and domain decisions to their owners.
4. Keep public behavior stable; keep every safety guarantee in place.
5. Run all gates; record durable lessons in memory.

## Review Expectation

A reviewer who cannot follow the flow, or who needs the author's explanation, has found a defect. Complexity is fixed in code, never explained away in a pull-request description.
