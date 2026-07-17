# Context — Orientation Pack

> The shared mental model. These files explain **how this NestJS backend is shaped and operated** so a new engineer or AI agent can act correctly on day one. They implement the canon defined in [architecture-map.md](./architecture-map.md) and [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

`/context` answers the questions that come **before** writing code: _Where do things live? What is the constant vs. the variable? Which command do I run? What does this word mean here?_ Rules tell you what you **must** do; skills are the **recipes**; agents **review**; memory records **why**. Context is the map you read first so the rest makes sense.

This workspace is **stack- and domain-agnostic**: the layering, boundaries, and naming are fixed; the business domain, ORM, database, cache, and broker are project choices. Examples below use neutral placeholders (`Article`, `Account`, `Order`, `Invoice`, "an email provider", "object storage") — never a real product.

---

## The files in this folder

| File                                                           | What it is                                                                                                                                                                                                                  | Read it when                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [architecture-map.md](./architecture-map.md)                   | **The single source of truth.** Layers and the one-way dependency rule, the canonical source tree, module anatomy, NestJS building-block placement, cross-cutting contracts, ESLint enforcement, and the request lifecycle. | Always. Before any structural decision.                      |
| [stack-and-toolchain.md](./stack-and-toolchain.md)             | The exact runtime, framework, lint/format, test, and git-hook toolchain, plus every npm script and the quality-gate command block. The business stack (ORM/DB/cache/broker) is left to the project.                         | Setting up, choosing a command, or wiring a tool.            |
| [codebase-navigation.md](./codebase-navigation.md)             | A "where do I put / find X" guide: directory walk-through, common-task → file-list cheatsheets (add an endpoint, add an event, add a config value, add a migration), and how to trace a request end to end.                 | Locating code or scaffolding a change.                       |
| [reference-patterns.md](./reference-patterns.md)               | Copy-ready, genericized snippets for each layer — controller, use case, service, repository, DTO, typed `AppError`, guard chain, adapter, event handler — matching the architecture map exactly.                            | You want the canonical shape to copy from.                   |
| [glossary.md](./glossary.md)                                   | Precise definitions of the vocabulary used everywhere: layer names, _service vs. use case_, `messageKey`, adapter, guard chain, ownership/tenant check, bounded query, quality gate.                                        | A term is ambiguous or you want shared language.             |
| [simple-code-map.md](./simple-code-map.md)                     | The simplicity router for [rules 20–30](../rules/README.md): where helpers/constants/decisions/shapes belong, when to extract, when **not** to create a new file, and which simplicity skill fits the situation.            | Running the Simple Code Ladder on any change.                |
| [contracts-map.md](./contracts-map.md)                         | The routing map for every contract kind (HTTP DTOs, errors, events, persistence, config, adapter ports) to its existing owner — there is no `contracts/` folder; each is owned by a rule or memory file.                    | Changing an API, event, schema, config, or adapter contract. |
| [declaration-ownership-map.md](./declaration-ownership-map.md) | Exact homes for constants, types, interfaces, enums, DTOs, helpers, policies, adapters, config, fixtures, and exports.                                                                                                      | Moving or adding a declaration.                              |
| [refactor-navigation.md](./refactor-navigation.md)             | Finding the focused cleanup skill and the responsibility-sliced execution order.                                                                                                                                            | Refactoring existing code.                                   |
| [agent-readiness-map.md](./agent-readiness-map.md)             | Agent load order, entrypoint roles, and synchronization set.                                                                                                                                                                | Updating policy or agent mirrors.                            |
| [security-clean-code-map.md](./security-clean-code-map.md)     | Owners and fixed order for auth, permissions, ownership, vendors, errors, and tests.                                                                                                                                        | Refactoring security-sensitive code.                         |
| [validation-clean-code-map.md](./validation-clean-code-map.md) | Owners for HTTP/config/provider validation and safe error behavior.                                                                                                                                                         | Refactoring DTOs, pipes, validators, or config.              |

---

## Recommended read order

For a human engineer **or** an AI agent picking up this workspace, read top to bottom. Each step builds on the last.

1. **[architecture-map.md](./architecture-map.md)** — the shape of everything. Internalize the layers, the one-way dependency rule, and module anatomy first; nothing else makes sense without it.
2. **[/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)** — the hard rules that never bend. Skim once now; they are referenced constantly.
3. **[stack-and-toolchain.md](./stack-and-toolchain.md)** — what runs the code and how to validate it. Memorize the quality-gate block.
4. **[glossary.md](./glossary.md)** — so the words mean the same thing to you as to the reviewers.
5. **[codebase-navigation.md](./codebase-navigation.md)** — how to find and place code in an actual tree.
6. **[declaration-ownership-map.md](./declaration-ownership-map.md)** and the matching security/validation/refactor map.
7. **[reference-patterns.md](./reference-patterns.md)** — the canonical snippets to copy when you start writing.
8. **The relevant [/rules](../rules/README.md) file(s)** for the layer you are touching.
9. **The matching [/skills](../skills/README.md) recipe** for the task.

> **AI agents:** treat steps 1–4 as required priming for every session, then jump to the rule + skill for the specific task. The fast-start map in [/memory/ai-context-map.md](../memory/ai-context-map.md) routes any request to its rule, skill, and reviewer.

---

## Context vs. the other folders

Keep the boundaries straight — each folder has one job.

| Folder     | Role                                                               | Entry point                                |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `/context` | **Orientation** — the map and the toolchain (this folder).         | this README                                |
| `/rules`   | **Law** — what you must and must not do, per layer.                | [/rules/README.md](../rules/README.md)     |
| `/skills`  | **Recipes** — step-by-step procedures with quality gates.          | [/skills/README.md](../skills/README.md)   |
| `/agents`  | **Reviewers** — specialist personas that audit a change.           | [/agents/README.md](../agents/README.md)   |
| `/memory`  | **Decisions** — durable conventions and the rationale behind them. | [/memory/README.md](../memory/README.md)   |
| `/testing` | **Quality** — the testing standards, coverage policy, and gates.   | [/testing/README.md](../testing/README.md) |

The relationship is one-way: **context describes the constants**, rules **enforce** them, skills **apply** them, agents **verify** them, memory **records why** they were chosen. `claude.md` wins globally; within subordinate engineering guidance, [architecture-map.md](./architecture-map.md) and [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) win.

---

## The constant vs. the variable

Read context with this filter — it is the whole point of the workspace.

**Constant (do not change without an ADR):**

- The layers and the one-way dependency rule: Controller → Application (Use case / Service) → Domain → Persistence → Integration.
- Module anatomy under `src/modules/<feature>/`, the `index.ts` public surface, and the `@/* @app/* @config/* @core/* @modules/* @shared/*` aliases.
- Cross-cutting contracts: typed config (no `process.env` outside `config/`/`bootstrap/`), the logger adapter (no `console.*`), typed `AppError` + `messageKey`, DTO validation at the boundary, vendors behind adapters, the auth + permissions + ownership guard chain.
- The quality gates and the coverage floor.

**Variable (the project decides):**

- The business domain and its features.
- The ORM (TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples), the database, cache, queue/broker, mailer, object storage, and APM — each kept behind a repository or an adapter.
- REST or GraphQL transport; modular monolith or microservice deployment.
- The set of supported locales (message keys are constant; the locale files are project-specific).

When a real project starts, it records its variable choices in [/memory/backend-stack.md](../memory/backend-stack.md), [/memory/project-architecture.md](../memory/project-architecture.md), and [/memory/database-decisions.md](../memory/database-decisions.md) — context stays generic, memory holds the specifics.

---

## Before you write a single line

A fast self-check that ties context to the gates you will actually face:

- [ ] I have read [architecture-map.md](./architecture-map.md) and know which layer my change belongs to.
- [ ] I have skimmed [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and the rule for that layer.
- [ ] I know the exact home for any new type/enum/constant/DTO (`model/`, `shared/`, `dto/`, `lib/`) — never inline ([simple-code-map.md](./simple-code-map.md)).
- [ ] I have run the Simple Code Ladder (rules 43–46): existing owner reused, no speculative abstraction, boring direct version chosen.
- [ ] I know the [skill](../skills/README.md) recipe for this task and the [reviewer agent](../agents/README.md) that will check it.
- [ ] I can run, from memory, the quality gates from [stack-and-toolchain.md](./stack-and-toolchain.md):

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest
npm run test:coverage   # 95% statements/functions/lines; 90% measured branches; real changed branches covered
npm run build           # compiles clean
```

If any box is unchecked, go back to the read order above before coding.

---

**Related:** [/rules/01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md) · [/skills/create-module.md](../skills/create-module.md) · [/memory/ai-context-map.md](../memory/ai-context-map.md) · [/testing/testing-strategy.md](../testing/testing-strategy.md) · [/claude.md](../claude.md)
