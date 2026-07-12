# AI Context Map (Memory)

> The fastest path for an AI agent to orient in this NestJS workspace. This is a durable convention — a read order across rules, skills, context, memory, and agents — that implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). Follow it before touching code.

## Decision

**Every agent orients along one fixed sequence — constants first, then the change-specific layer, then the durable memory — before writing a line of code.** Skimming a single file and guessing is the failure mode this map exists to prevent. Read order is not optional; depth scales with the change, the sequence does not.

**Rationale:** The architecture is enforced mechanically (TypeScript strict, the custom `architecture/*` ESLint plugin, Husky gates). An agent that writes against the wrong mental model produces work the gates reject. A few minutes of targeted reading is cheaper than a rejected branch, and it keeps every agent — and every project built on this workspace — converging on the same house standard.

> Project records: name the product, primary entry tool (CLAUDE.md / AGENTS.md / Cursor rules), and the canonical feature folder under [`/docs/features/`](../docs/features/_template/) here.

---

## The orientation sequence (read in this order)

| Step | Read                                                                                                                                      | Why                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | [/claude.md](../claude.md) (and the tool entry file the project uses)                                                                     | The operating brain + SDLC gates. Establishes phases and authority.     |
| 2    | [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)                                                                         | The 50 hard rules. If a request conflicts, the rule wins.               |
| 3    | [/context/architecture-map.md](../context/architecture-map.md)                                                                            | The single source of truth for layers, boundaries, and the module tree. |
| 4    | [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)                                                                      | Toolchain, aliases, exact commands.                                     |
| 5    | [known-pitfalls.md](./known-pitfalls.md)                                                                                                  | Recurring mistakes to avoid before editing.                             |
| 6    | The **task-specific rule + skill** (tables below)                                                                                         | The narrow standard for the layer you are about to touch.               |
| 7    | [/context/codebase-navigation.md](../context/codebase-navigation.md) + [/context/reference-patterns.md](../context/reference-patterns.md) | Where the real files live + copy-ready patterns.                        |

Steps 1–5 are the **constant warm-up** for any task. Steps 6–7 are **change-specific**.

---

## Route by task → rule + skill

Pick the row that matches the change, then read its rule and run its skill.

| You are about to…                                  | Rule                                                                                                                              | Skill                                                                                                                                                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold a feature module                          | [01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md)                                     | [create-module.md](../skills/create-module.md)                                                                                                                                                                                   |
| Add/edit a controller                              | [02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md)                                             | [create-controller.md](../skills/create-controller.md)                                                                                                                                                                           |
| Add multi-step/transactional orchestration         | [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)                                     | [create-use-case.md](../skills/create-use-case.md)                                                                                                                                                                               |
| Add a focused capability                           | [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)                                     | [create-service.md](../skills/create-service.md)                                                                                                                                                                                 |
| Touch persistence                                  | [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)                                                 | [create-repository.md](../skills/create-repository.md)                                                                                                                                                                           |
| Add/validate a DTO                                 | [05-dto-and-validation.md](../rules/05-dto-and-validation.md)                                                                     | [create-dto-validation.md](../skills/create-dto-validation.md)                                                                                                                                                                   |
| Add/move a type/interface/enum/constant            | [30-declaration-ownership.md](../rules/30-declaration-ownership.md)                                                               | [extract-constants-types-enums.md](../skills/extract-constants-types-enums.md) / [refactor-inline-declarations.md](../skills/refactor-inline-declarations.md)                                                                    |
| Add a guard / permission                           | [07-security-authn-authz.md](../rules/07-security-authn-authz.md)                                                                 | [add-guard-and-permission.md](../skills/add-guard-and-permission.md)                                                                                                                                                             |
| Wrap an external library                           | [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)                                               | [add-library-adapter.md](../skills/add-library-adapter.md)                                                                                                                                                                       |
| Emit/handle an event or job                        | [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)                                                               | [add-event-handler.md](../skills/add-event-handler.md)                                                                                                                                                                           |
| Add a config value                                 | [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)                                               | [add-config-value.md](../skills/add-config-value.md)                                                                                                                                                                             |
| Define/raise an error                              | [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)                                               | [create-error.md](../skills/create-error.md)                                                                                                                                                                                     |
| Add a message key / locale string                  | [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)                                                                     | [add-i18n-message-key.md](../skills/add-i18n-message-key.md)                                                                                                                                                                     |
| Schema change / backfill                           | [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md)                                               | [migration-plan.md](../skills/migration-plan.md)                                                                                                                                                                                 |
| Write any new code (the default posture)           | [20-simple-readable-code.md](../rules/20-simple-readable-code.md)                                                                 | [write-simple-readable-code.md](../skills/write-simple-readable-code.md)                                                                                                                                                         |
| Add any new file / helper / constant               | [22-reuse-before-creating.md](../rules/22-reuse-before-creating.md)                                                               | [reuse-before-creating.md](../skills/reuse-before-creating.md)                                                                                                                                                                   |
| Extract repeated logic / a complex condition       | [23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md)                               | [extract-helper-safely.md](../skills/extract-helper-safely.md)                                                                                                                                                                   |
| Split an oversized service / use case / repository | [23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md)                               | [split-large-service.md](../skills/split-large-service.md) / [split-large-use-case.md](../skills/split-large-use-case.md) / [split-large-repository.md](../skills/split-large-repository.md)                                     |
| Simplify overbuilt / clever / dead code            | [21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md)                                                                 | [simplify-existing-code.md](../skills/simplify-existing-code.md) / [refactor-smart-code-to-boring-code.md](../skills/refactor-smart-code-to-boring-code.md) / [remove-unnecessary-code.md](../skills/remove-unnecessary-code.md) |
| Review a diff for readability                      | [24-team-readable-code-review.md](../rules/24-team-readable-code-review.md)                                                       | [review-for-readable-code.md](../skills/review-for-readable-code.md)                                                                                                                                                             |
| Run a repository-wide cleanup                      | [28-codebase-refactor-discipline.md](../rules/28-codebase-refactor-discipline.md)                                                 | [full-codebase-cleanup.md](../skills/full-codebase-cleanup.md)                                                                                                                                                                   |
| Refactor security/validation without weakening     | [07-security-authn-authz.md](../rules/07-security-authn-authz.md) / [05-dto-and-validation.md](../rules/05-dto-and-validation.md) | [cleanup-security-code-without-weakening.md](../skills/cleanup-security-code-without-weakening.md) / [cleanup-validation-code-without-weakening.md](../skills/cleanup-validation-code-without-weakening.md)                      |
| Update agent entrypoints/mirrors                   | [29-agent-readiness-and-mirrors.md](../rules/29-agent-readiness-and-mirrors.md)                                                   | [prepare-agent-mirrors.md](../skills/prepare-agent-mirrors.md)                                                                                                                                                                   |
| Resolve context for a task (compiled AI layer)     | —                                                                                                                                 | Run `npm run knowledge:context -- --task="…"`; read `.ai/local/current-context.md` (see [tools/knowledge](../tools/knowledge))                                                                                                   |
| Change an API/event/schema/config/adapter contract | [contracts-map.md](../context/contracts-map.md) routes to the owner                                                               | the owner rule's skill (e.g. [create-dto-validation.md](../skills/create-dto-validation.md), [add-config-value.md](../skills/add-config-value.md), [add-library-adapter.md](../skills/add-library-adapter.md))                   |

---

## Route by goal → reviewer agent

When the task is "review / harden / validate" rather than "build", read the rule and invoke the matching agent.

| Goal                        | Rule                                                                                          | Agent                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Architecture / boundary fit | [01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md) | [backend-architect.md](../agents/backend-architect.md)                       |
| General correctness review  | [15-review-checklist.md](../rules/15-review-checklist.md)                                     | [backend-code-reviewer.md](../agents/backend-code-reviewer.md)               |
| Security & authz            | [07-security-authn-authz.md](../rules/07-security-authn-authz.md)                             | [backend-security-reviewer.md](../agents/backend-security-reviewer.md)       |
| Injection / data safety     | [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md)           | [database-reviewer.md](../agents/database-reviewer.md)                       |
| Performance / scalability   | [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md)               | [backend-performance-reviewer.md](../agents/backend-performance-reviewer.md) |
| Reliability / durability    | [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)                 | [reliability-engineer.md](../agents/reliability-engineer.md)                 |
| Observability               | [14-observability-and-logging.md](../rules/14-observability-and-logging.md)                   | [observability-reviewer.md](../agents/observability-reviewer.md)             |
| Tests / coverage            | [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)                             | [backend-test-engineer.md](../agents/backend-test-engineer.md)               |
| Release gate                | [15-review-checklist.md](../rules/15-review-checklist.md)                                     | [backend-release-gatekeeper.md](../agents/backend-release-gatekeeper.md)     |

---

## Memory you may need (deeper context, not warm-up)

Read these when a decision needs prior rationale — not on every task.

| Question                                        | Memory note                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| What stack/toolchain did we standardize on?     | [backend-stack.md](./backend-stack.md)                                                                                                      |
| Why is the architecture shaped this way?        | [project-architecture.md](./project-architecture.md)                                                                                        |
| What ORM / data conventions apply?              | [database-decisions.md](./database-decisions.md)                                                                                            |
| How is auth/authz modeled?                      | [security-decisions.md](./security-decisions.md)                                                                                            |
| What performance trade-offs exist?              | [performance-decisions.md](./performance-decisions.md)                                                                                      |
| What reliability patterns are canonical?        | [reliability-patterns.md](./reliability-patterns.md)                                                                                        |
| How do we log/trace/alert?                      | [observability-decisions.md](./observability-decisions.md)                                                                                  |
| How do events/notifications flow?               | [event-notification-decisions.md](./event-notification-decisions.md)                                                                        |
| Which libraries are wrapped, and why?           | [library-boundaries.md](./library-boundaries.md)                                                                                            |
| How do we test?                                 | [testing-strategy.md](./testing-strategy.md)                                                                                                |
| Why simple/boring code, and where is the line?  | [code-simplicity-decisions.md](./code-simplicity-decisions.md)                                                                              |
| How are broad refactors sliced?                 | [refactor-decisions.md](./refactor-decisions.md)                                                                                            |
| How do agent mirrors stay aligned?              | [agent-readiness-decisions.md](./agent-readiness-decisions.md)                                                                              |
| How do security/validation refactors stay safe? | [security-refactor-decisions.md](./security-refactor-decisions.md) / [validation-refactor-decisions.md](./validation-refactor-decisions.md) |
| What personal data does this repo process?      | [privacy-decisions.md](./privacy-decisions.md)                                                                                              |
| What is the operational/deployment model?       | [operations-decisions.md](./operations-decisions.md)                                                                                        |
| What blocks a release?                          | [release-checklist.md](./release-checklist.md)                                                                                              |

> Project records: list any project-specific memory notes (third-party SLAs, tenancy model, region/compliance constraints) added beyond this set here.

---

## Worked routes (Do / Don't)

**Task: "Add an endpoint that creates an `Order` and notifies the customer."** (`Order` is an illustrative placeholder.)

Do — follow the sequence, then route by layer:

```text
1–5  warm-up (claude.md → rules/00 → architecture-map → toolchain → known-pitfalls)
6    create-dto-validation  → create-use-case (multi-entity + post-commit event)
6    create-service (focused writes)  → create-repository (bounded persistence)
6    add-guard-and-permission (auth + RBAC + ownership)  → add-event-handler (fail-safe notify)
6    create-error (errors.order.* message keys)  → add-i18n-message-key (each supported locale)
7    reference-patterns for copy-ready layer code; codebase-navigation for real paths
```

Don't — skip the map and guess:

```text
✗ Open one controller, infer the pattern, inline a DTO + a status string, call a repo directly.
  Result: violates rules 9, 14, 18 and the architecture/* ESLint plugin → branch rejected at the gate.
```

---

## Maintenance convention

Treat this map as a living index, not a static doc.

- When a **new rule, skill, or agent** is added, add its row here in the same change.
- When a **recurring mistake** is discovered, record it in [known-pitfalls.md](./known-pitfalls.md) and cross-check that the relevant rule already covers it.
- When the **read order itself** changes (a new mandatory warm-up file), update the sequence table and the [/context/README.md](../context/README.md) hub together.
- Keep cross-links pointing at sibling files that exist; a dead link in the orientation path defeats the map's purpose.

> Project records: name the owner responsible for keeping this map current and the review cadence here.

---

## Checklist (before you start editing)

- [ ] Read steps 1–5 (claude.md, rules/00, architecture-map, toolchain, known-pitfalls)
- [ ] Identified the task layer and read its **rule + skill** (route table)
- [ ] If reviewing, invoked the matching **agent** (goal table)
- [ ] Pulled real paths from [/context/codebase-navigation.md](../context/codebase-navigation.md) and patterns from [/context/reference-patterns.md](../context/reference-patterns.md)
- [ ] Confirmed no rule conflict; if one exists, surfaced it and let the rule win
- [ ] Added/updated map rows if this change introduced a new rule, skill, or agent
