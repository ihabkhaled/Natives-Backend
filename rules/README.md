# Engineering Rules — Index

> The layer-by-layer engineering rulebook for any NestJS backend built in this workspace. These rules **apply** the architecture in [`/context/architecture-map.md`](../context/architecture-map.md) and are mechanically backed by [`/eslint`](../eslint) + [`tsconfig.json`](../tsconfig.json). The master list of hard rules is [`00-non-negotiable-rules.md`](./00-non-negotiable-rules.md).

These engineering rules sit **inside** the governance lifecycle defined by the root [`/claude.md`](../claude.md) (the SDLC operating brain). The SDLC tells you _which phases and artifacts_ a change must pass through; these rules tell you _how the code itself must be written_.

## How to use

1. Start at [`00-non-negotiable-rules.md`](./00-non-negotiable-rules.md) — the hard checklist.
2. Open the rule file for the layer you're touching.
3. Follow the matching [skill](../skills/README.md) for the step-by-step procedure.
4. Run the [quality gates](../context/stack-and-toolchain.md#quality-gates-all-green-before-done) before declaring done.

## The rulebook

| #   | File                                                                                           | Covers                                                                                |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 00  | [`00-non-negotiable-rules.md`](./00-non-negotiable-rules.md)                                   | The hard, ESLint/TS-enforced master checklist                                         |
| 01  | [`01-architecture-and-module-boundaries.md`](./01-architecture-and-module-boundaries.md)       | Layers, module anatomy, import boundaries, public surfaces                            |
| 02  | [`02-controllers-and-http-transport.md`](./02-controllers-and-http-transport.md)               | Thin controllers, decorators, guards/pipes/interceptors                               |
| 03  | [`03-application-services-and-use-cases.md`](./03-application-services-and-use-cases.md)       | Service vs use case, method-size budget, orchestration, transactions                  |
| 04  | [`04-repositories-and-persistence.md`](./04-repositories-and-persistence.md)                   | Repository pattern, ORM-agnostic persistence, pagination                              |
| 05  | [`05-dto-and-validation.md`](./05-dto-and-validation.md)                                       | DTOs, class-validator (primary), Zod-via-pipe (alternative)                           |
| 06  | [`06-types-enums-constants.md`](./06-types-enums-constants.md)                                 | Zero-inline policy, dedicated files, no-duplicate-helper rule                         |
| 07  | [`07-security-authn-authz.md`](./07-security-authn-authz.md)                                   | Auth/permissions guards, RBAC catalog, ownership/tenant isolation                     |
| 08  | [`08-database-and-injection-safety.md`](./08-database-and-injection-safety.md)                 | Parameterization, injection safety, transactions, migrations                          |
| 09  | [`09-performance-and-scalability.md`](./09-performance-and-scalability.md)                     | N+1, indexes, pagination, caching, concurrency                                        |
| 10  | [`10-reliability-and-durability.md`](./10-reliability-and-durability.md)                       | Timeouts, retries, idempotency, graceful degradation/shutdown                         |
| 11  | [`11-testing-and-coverage.md`](./11-testing-and-coverage.md)                                   | Test layers, TDD, coverage gate, what to test where                                   |
| 12  | [`12-library-wrapping-and-adapters.md`](./12-library-wrapping-and-adapters.md)                 | Wrapping external libraries behind adapters                                           |
| 13  | [`13-eslint-and-typescript.md`](./13-eslint-and-typescript.md)                                 | The lint/TS rule catalog and how to satisfy it                                        |
| 14  | [`14-observability-and-logging.md`](./14-observability-and-logging.md)                         | Structured logging, metrics, tracing, redaction                                       |
| 15  | [`15-review-checklist.md`](./15-review-checklist.md)                                           | The consolidated pre-merge review gate                                                |
| 16  | [`16-i18n-and-messaging.md`](./16-i18n-and-messaging.md)                                       | `messageKey` discipline, localization                                                 |
| 17  | [`17-configuration-and-environment.md`](./17-configuration-and-environment.md)                 | Typed config, env validation, secrets, feature flags                                  |
| 18  | [`18-error-handling-and-exceptions.md`](./18-error-handling-and-exceptions.md)                 | Typed `AppError` hierarchy + global exception filter                                  |
| 19  | [`19-async-events-and-jobs.md`](./19-async-events-and-jobs.md)                                 | Event bus, background jobs, queues, terminal states                                   |
| 20  | [`20-simple-readable-code.md`](./20-simple-readable-code.md)                                   | The Simple Code Ladder, junior-readable/senior-trustworthy bar, no clever TypeScript  |
| 21  | [`21-yagni-and-minimalism.md`](./21-yagni-and-minimalism.md)                                   | No speculative abstraction, the 1–2–3 rule, minimal means minimum safe code           |
| 22  | [`22-reuse-before-creating.md`](./22-reuse-before-creating.md)                                 | Search-the-owner-first, never ship a parallel duplicate                               |
| 23  | [`23-function-service-file-size-discipline.md`](./23-function-service-file-size-discipline.md) | Per-layer size budgets, extraction routing, helper-driven maintainability             |
| 24  | [`24-team-readable-code-review.md`](./24-team-readable-code-review.md)                         | The nineteen readability review questions                                             |
| 25  | [`25-no-clever-typescript.md`](./25-no-clever-typescript.md)                                   | Plain contracts, the 30-second type rule, no type gymnastics                          |
| 26  | [`26-helper-driven-maintainability.md`](./26-helper-driven-maintainability.md)                 | When helpers earn an owner and when direct code is clearer                            |
| 27  | [`27-no-token-burning-code.md`](./27-no-token-burning-code.md)                                 | Protect human/AI context, review, CI, and runtime budgets                             |
| 28  | [`28-codebase-refactor-discipline.md`](./28-codebase-refactor-discipline.md)                   | Tests-first, responsibility-sliced whole-codebase cleanup                             |
| 29  | [`29-agent-readiness-and-mirrors.md`](./29-agent-readiness-and-mirrors.md)                     | Canonical precedence, compact entrypoints, mirror synchronization                     |
| 30  | [`30-declaration-ownership.md`](./30-declaration-ownership.md)                                 | Canonical homes for constants, types, interfaces, enums, DTOs, helpers, and maps      |
| 31  | [`31-ci-gates-before-commit-and-push.md`](./31-ci-gates-before-commit-and-push.md)             | Every CI gate green before commit and push, incl. knowledge build and all-gates-green |

## Standard workflow (every task)

1. Read [`00-non-negotiable-rules.md`](./00-non-negotiable-rules.md) → the layer rule(s) → [`/memory/known-pitfalls.md`](../memory/known-pitfalls.md).
2. Inspect the real code before editing — mirror an existing clean module; never invent contracts.
3. Run the Simple Code Ladder ([`20-simple-readable-code.md`](./20-simple-readable-code.md)): reuse an existing owner before creating anything new; prefer the boring direct version.
4. Route every declaration through [`30-declaration-ownership.md`](./30-declaration-ownership.md) and every broad cleanup through [`28-codebase-refactor-discipline.md`](./28-codebase-refactor-discipline.md).
5. **Write/update tests first.**
6. Make the minimal safe change in the correct layer.
7. Run lint → typecheck → test → coverage → build until green, then the knowledge, contract, and security gates — **every gate must be green before you commit and before you push** ([`31-ci-gates-before-commit-and-push.md`](./31-ci-gates-before-commit-and-push.md)). After any `src/**` or corpus change run `npm run knowledge:build` and commit `.ai/**`.
8. Update docs and the relevant SDLC artifacts ([`/docs`](../docs)).
9. On a permanent change, update `claude.md` first; synchronize full `codex.md`/`cursor.md`, then compact pointers in `AGENTS.md`, all six family routers, `.cursorrules`, and `.cursor/rules`; record recurring mistakes in [`memory/known-pitfalls.md`](../memory/known-pitfalls.md).
