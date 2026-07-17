# 01 — Business Analysis

## Problem statement

IronNest already states strong simplicity rules, but policy and executable reference code are not fully aligned. Direct vendor coupling, incomplete declaration ownership, weak authorization vocabulary, stale examples, and partial config validation force each reviewer or AI agent to rediscover exceptions. That increases review time and makes unsafe duplication more likely.

## Stakeholders and personas

Junior, mid-level, and senior backend engineers; tech leads; QA and security reviewers; platform/support engineers; future maintainers; and AI coding agents operating under time pressure.

## Current state

- Rules 20–24 define the Simple Code Ladder and readable-code bar.
- The architecture plugin enforces module-level declarations but misses nested inline type literals and definite-assignment assertions.
- The reference app demonstrates most architecture rules but carries auth, ownership, config, and documentation inconsistencies.
- Agent guidance is split across full mirrors and compact family entrypoints, with no explicit declaration/refactor navigation layer.

## Desired state

The governance tree and runnable backend agree: one owner per declaration, vendors behind app-owned ports/adapters, permission checks are central, ownership scoping is bounded and non-leaking, all consumed config is fail-fast validated, examples compile conceptually under the same rules, and agents can locate the correct owner without inventing structure.

## Business goals and success metrics

- Reduce repeated review findings for inline declarations, vendor leakage, clever code, and duplicate owners.
- Make the reference module safe to copy without hidden exceptions.
- Keep lint/type/test/coverage/build/security gates green with no threshold reduction.
- Achieve at least 95% lines/functions/statements and the existing 90% branch floor for touched logic.
- Leave no undocumented direct third-party import outside its approved owner.

## Assumptions

- The repository is a private reference operating system, so internal public barrels may evolve with tests/docs in the same change.
- The in-memory reference stores remain; no database migration is required.
- `codex.md` is the requested GPT-family full mirror; creating another full copy would add drift and token cost.
- Existing runtime contracts remain stable except deliberate security/error-contract improvements documented in product requirements.

## Dependencies

NestJS 11, strict TypeScript, ESLint 10 custom architecture plugin, Vitest, existing Fastify/Pino/config/validation adapters, and current package scripts.

## Risks of not doing the work

Future modules copy direct SDK imports, raw role strings, leaking ownership queries, partial environment validation, and stale `!`-based DTO patterns while believing they satisfy the operating system.
