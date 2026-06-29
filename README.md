# Claude Ranger — Strict NestJS Backend Operating System

This repository is two complementary operating systems in one:

1. **An enterprise SDLC governance brain** ([`claude.md`](./claude.md)) — the stack-agnostic policy that forces every request through a complete, documented lifecycle (intake → analysis → architecture → tests → implementation → QA → security → release → hypercare → retrospective) with hard, non-skippable gates.
2. **A concrete NestJS engineering operating system** — everything the best NestJS teams need to start a backend *from scratch* without re-deriving any of it: strict TypeScript, a custom architecture-enforcing ESLint setup, layered architecture, rules, skills, agents, memory, context, and testing standards.

The governance brain tells you **which phases and gates** a change must pass. The engineering OS tells you **exactly how the code must be written** so it is clean, layered, type-safe, secure, observable, testable, and free of spaghetti — no inline consts/enums/types/interfaces, thin controllers, orchestrating services, persistence-only repositories, and external libraries wrapped behind adapters.

Everything here is **100% broad and abstract for any NestJS backend** — modular monolith or microservice, any ORM, any database, any domain.

---

## What you get

### Engineering operating system (the "how")

| Layer | Path | What it is |
| --- | --- | --- |
| **Rules** | [`/rules`](./rules/README.md) | 20 layer-by-layer engineering rules, starting with the [non-negotiables](./rules/00-non-negotiable-rules.md) |
| **Skills** | [`/skills`](./skills/README.md) | Step-by-step task playbooks (create a module/controller/service/repository, add a guard, write tests, review, migrate…) |
| **Context** | [`/context`](./context/README.md) | The [architecture map](./context/architecture-map.md), [stack & toolchain](./context/stack-and-toolchain.md), [task router](./context/codebase-navigation.md), and [canonical code patterns](./context/reference-patterns.md) |
| **Memory** | [`/memory`](./memory/README.md) | Durable, abstract decisions & the [learned-pitfalls log](./memory/known-pitfalls.md) |
| **Agents** | [`/agents`](./agents/README.md) | Specialist review roles (architect, security, performance, tests, database, reliability, release gatekeeper…) |
| **Testing** | [`/testing`](./testing/README.md) | Engineering testing standards (strategy, unit/integration/e2e, coverage, fixtures, gates) |
| **ESLint** | [`/eslint`](./eslint) | Modular flat configs + a **custom architecture plugin** that mechanically enforces the layering |

### Tooling kit (drop-in configs, exact pins)

Root-level, ready to copy into any NestJS project: [`package.json`](./package.json), [`tsconfig.json`](./tsconfig.json) / [`tsconfig.eslint.json`](./tsconfig.eslint.json) / [`tsconfig.build.json`](./tsconfig.build.json), [`eslint.config.mjs`](./eslint.config.mjs), [`.prettierrc`](./.prettierrc), [`.lintstagedrc.cjs`](./.lintstagedrc.cjs), [`commitlint.config.cjs`](./commitlint.config.cjs), [`vitest.config.mts`](./vitest.config.mts), [`nest-cli.json`](./nest-cli.json), [`.husky/`](./.husky) (pre-commit, commit-msg, pre-push), [`.env.example`](./.env.example), [`.editorconfig`](./.editorconfig).

### SDLC governance (the "what / when / gates")

- [`claude.md`](./claude.md) — the permanent operating brain (canonical).
- [`docs/sdlc/`](./docs/sdlc) — permanent baseline policy (engineering, QA, security, release, risk, docs).
- [`docs/features/_template/`](./docs/features/_template) — the per-request artifact set (phases `00`–`27`).
- [`test-cases/`](./test-cases), [`runbooks/`](./runbooks), [`architecture/adrs/`](./architecture/adrs), [`release-notes/`](./release-notes), [`support/`](./support).

---

## The canonical architecture (in one breath)

```
Controller (api/*.controller.ts, thin, one delegation/method)
  → Application (application/*.use-case.ts for orchestration+transactions; *.service.ts focused, ≤20 lines/method)
    → Domain (domain/ policies, entities, state machines — pure)
      → Persistence (infrastructure/*.repository.ts — parameterized, bounded)
        → Integration (adapters/*.adapter.ts — every external library wrapped)
Cross-cutting: src/core (logger, errors+filter, guards, interceptors, pipes, events) · src/config · src/shared
```

Dependencies point one way only, and the boundaries are **enforced by ESLint**, not by hope. Full detail: [`/context/architecture-map.md`](./context/architecture-map.md).

## Quick start

**Start a new NestJS backend from this workspace**

1. Read [`/context/architecture-map.md`](./context/architecture-map.md) and [`/rules/00-non-negotiable-rules.md`](./rules/00-non-negotiable-rules.md).
2. `npm install` to pull the pinned toolchain, then `npm run prepare` to install the Husky hooks.
3. Create your first feature with the [`create-module`](./skills/create-module.md) skill; build endpoints with the [`create-controller`](./skills/create-controller.md) → [`create-use-case`](./skills/create-use-case.md) / [`create-service`](./skills/create-service.md) → [`create-repository`](./skills/create-repository.md) skills.
4. Keep all gates green: `npm run lint && npm run typecheck && npm run test:coverage && npm run build`.

**Add the strict kit to an existing NestJS project**

Copy the root configs + [`/eslint`](./eslint) into your repo, merge the `package.json` dependencies, run `npm install`, then drive `npm run lint` to zero by fixing root causes (never disabling rules).

## How the two systems fit together

- For **process** ("am I allowed to ship, and what artifacts are required?") → follow [`claude.md`](./claude.md) and the [`docs/`](./docs) templates.
- For **code** ("how do I write this NestJS change correctly?") → follow [`/rules`](./rules/README.md), the matching [`/skill`](./skills/README.md), and the [`/context`](./context/README.md) patterns, verified by [`/agents`](./agents/README.md).
- When they overlap, the **stricter** guidance wins; if anything contradicts [`claude.md`](./claude.md), `claude.md` wins.

## Tool compatibility

The same standards are exposed to every AI coding tool — kept in sync:

- [`claude.md`](./claude.md) — canonical source of truth.
- [`AGENTS.md`](./AGENTS.md) — Codex bootstrap (reads `claude.md` + the engineering OS).
- [`.cursor/rules/*.mdc`](./.cursor/rules) — active Cursor rules.
- [`.cursorrules`](./.cursorrules) — legacy Cursor shim.
- [`codex.md`](./codex.md) / [`cursor.md`](./cursor.md) — mirror/reference copies.

If any compatibility file ever differs from `claude.md`, `claude.md` wins.
