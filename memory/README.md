# Memory — Durable Decisions Index

> The fast-recall layer for AI agents: the concrete decisions, conventions, and gotchas to know _before_ touching code. Memory distills the canon — it never overrides it. When memory and a rule disagree, the rule wins; fix the memory file.

Memory is **not** policy. The rules in [`/rules`](../rules/README.md) define what is mandatory; the context in [`/context`](../context/README.md) explains the architecture and toolchain. Memory captures _what this project actually decided_ inside that frame: the chosen ORM, the bcrypt cost, the cache TTL, the recurring mistake that bit someone twice. These are **durable, abstract conventions** — written so they stay true as the project evolves, with clearly-labeled slots where a real project records its specifics.

## How memory relates to rules and context

| Layer                              | Question it answers                                      | Authority                           |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| [`/rules`](../rules/README.md)     | What _must_ every change satisfy?                        | Mandatory, enforced by ESLint + CI  |
| [`/context`](../context/README.md) | How is the system _structured_, and with what tools?     | Single source of truth for shape    |
| **`/memory`** (here)               | What did _this_ project _decide_, and what bites people? | Durable convention; defers to rules |
| [`/skills`](../skills/README.md)   | How do I _perform_ a recurring task correctly?           | Procedure                           |
| [`/agents`](../agents/README.md)   | Who _reviews_ a change for a given concern?              | Role                                |

Read memory to load decisions fast. Read rules to confirm a decision is still compliant. Read context to confirm where code goes.

## Read order for an agent

1. [`ai-context-map.md`](./ai-context-map.md) — the load order and where to look first.
2. [`known-pitfalls.md`](./known-pitfalls.md) — recurring mistakes; **read before writing code**.
3. [`project-architecture.md`](./project-architecture.md) — the module map and boundaries for _this_ project.
4. [`backend-stack.md`](./backend-stack.md) — exact stack, scripts, and gates.
5. The decision file matching your task (security, database, performance, …).

## File index

| File                                                                   | Holds                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`backend-stack.md`](./backend-stack.md)                               | The exact runtime, framework version, ORM choice, validator choice, and every `package.json` script with what it does. Records the Husky gates (pre-commit, commit-msg, pre-push) and that tooling is `tsgo --noEmit`, Vitest, and the project's chosen ORM — not legacy `tsc`/`jest`.                                                                                 |
| [`project-architecture.md`](./project-architecture.md)                 | This project's instance of the canonical layout: the feature modules that exist, the layer model, key entrypoints (`main.ts`, `app.module.ts`, `bootstrap/`, `config/`), path aliases, and the import boundaries enforced by the ESLint `architecture/*` plugin. Mirrors [`/context/architecture-map.md`](../context/architecture-map.md) for _concrete_ module names. |
| [`database-decisions.md`](./database-decisions.md)                     | The chosen ORM and database, how the data source is configured, migration discovery + naming convention, index conventions, soft-delete pattern, and any known FK/constraint caveats. ORM-agnostic by design — the decision, not the vendor, is the durable part.                                                                                                      |
| [`security-decisions.md`](./security-decisions.md)                     | Password hashing cost, token expiry/rotation, CORS allow-list, security headers, timing-safe comparison usage, and the file-upload validation pipeline. The guard chain (auth → permissions → ownership/tenant) and identity-from-token rule live in [`/rules/07-security-authn-authz.md`](../rules/07-security-authn-authz.md).                                       |
| [`performance-decisions.md`](./performance-decisions.md)               | Bounded-list limits (hard max 100), index choices, N+1 avoidance patterns, payload sizing, and cache behavior/TTLs. Durable performance notes that back [`/rules/09-performance-and-scalability.md`](../rules/09-performance-and-scalability.md).                                                                                                                      |
| [`reliability-patterns.md`](./reliability-patterns.md)                 | Fire-and-forget event-handler conventions, graceful shutdown, startup health/migration steps, scheduled-job behavior, retry/timeout/idempotency defaults, and resilience under partial failure. Backs [`/rules/10-reliability-and-durability.md`](../rules/10-reliability-and-durability.md).                                                                          |
| [`observability-decisions.md`](./observability-decisions.md)           | Structured-log shape, redaction list (secrets/PII), correlation-id propagation, and how to diagnose integration + background-job failures. Backs [`/rules/14-observability-and-logging.md`](../rules/14-observability-and-logging.md).                                                                                                                                 |
| [`event-notification-decisions.md`](./event-notification-decisions.md) | Domain-event names and post-commit emission order, subscription/fan-out conventions, and notification delivery via integration adapters (email/SMS/push providers behind adapters). Backs [`/rules/19-async-events-and-jobs.md`](../rules/19-async-events-and-jobs.md).                                                                                                |
| [`library-boundaries.md`](./library-boundaries.md)                     | The adapter map: which external library each adapter wraps, the app-owned interface it exposes, and any library still used directly (a labeled TODO to wrap it). Backs [`/rules/12-library-wrapping-and-adapters.md`](../rules/12-library-wrapping-and-adapters.md).                                                                                                   |
| [`testing-strategy.md`](./testing-strategy.md)                         | Unit vs. integration vs. e2e split, the coverage floor (95%, critical paths near 100%) and any documented exclusions, mocking conventions, and the database-in-tests strategy. Mirrors [`/testing/testing-strategy.md`](../testing/testing-strategy.md).                                                                                                               |
| [`release-checklist.md`](./release-checklist.md)                       | The commit/push safety checklist: diff review, explicit staging, the quality-gate command block, and "no secrets / no generated output committed." Mirrors [`/testing/quality-gates.md`](../testing/quality-gates.md).                                                                                                                                                 |
| [`code-simplicity-decisions.md`](./code-simplicity-decisions.md)       | Why simple readable code is permanent policy: the Simple Code Ladder, minimum-safe-code, no clever TypeScript, no speculative abstraction, reuse-before-create, helper ownership, and no token-burning output. Backs [`/rules/20`](../rules/20-simple-readable-code.md)–[`24`](../rules/24-team-readable-code-review.md) (rules 43–46).                                |
| [`known-pitfalls.md`](./known-pitfalls.md)                             | The running log of recurring mistakes and their fixes, including toolchain-migration gotchas. Append-only; **the first file to read before writing code.**                                                                                                                                                                                                             |
| [`ai-context-map.md`](./ai-context-map.md)                             | Fast recall of context load order and synchronization points for future agents — which files to read for which task, and which files must change together.                                                                                                                                                                                                             |

## How to write a durable memory file

Each memory file states a **decision + rationale**, not a tutorial. Keep it abstract enough to survive a refactor, and mark the project-specific slots explicitly so they are easy to find and update.

```md
## Decision: list responses are bounded

**What:** every list endpoint paginates; hard max page size is 100.
**Why:** unbounded reads are an availability and memory risk.
**Specifics (this project):** <!-- fill in -->

- default page size: ___
- enforced in: ___.repository.ts
  **See:** /rules/09-performance-and-scalability.md
```

Do:

```md
## Decision: password hashing

**What:** hash with an adaptive KDF; never store plaintext or fast hashes.
**Why:** offline brute-force resistance.
**Specifics (this project):** cost factor = ___; rotate on policy change.
```

Don't:

```md
We use bcrypt(12) because the last project did. (no rationale, no abstraction,
no project slot, will rot the first time the cost factor changes)
```

## Maintenance rule

Memory is a living record, kept in the **same change** as the behavior it describes.

- When a recurring mistake appears, append it to [`known-pitfalls.md`](./known-pitfalls.md) with the fix and the rule it relates to.
- When a documented decision changes (a config default, a new module, a new integration, a swapped library), update the matching memory file in the same pull request — never change behavior without updating its memory + tests + docs.
- If a memory note hardens into something every change must satisfy, **promote it to a rule** in [`/rules`](../rules/README.md) and update [`/context/architecture-map.md`](../context/architecture-map.md) if the shape changed; leave a pointer behind in memory.
- If memory and a rule disagree, the rule is authoritative — correct the memory file, and open a question if the rule itself looks wrong.

**Related:** [`/rules/README.md`](../rules/README.md) · [`/context/README.md`](../context/README.md) · [`/skills/README.md`](../skills/README.md) · [`/agents/README.md`](../agents/README.md) · [`/testing/README.md`](../testing/README.md)
