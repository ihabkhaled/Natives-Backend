# Agent Roles — Index

> The roster of review roles for this NestJS backend operating system, the shared workflow every role runs, the universal guardrails none may relax, and the exact quality-gate commands. Each role is a focused operating manual that implements the canon — it does not replace it.

These roles are **lenses on the specification**, not a substitute for it. The canonical sources, in precedence order, are the same as `claude.md` and `AGENTS.md`:

1. [/claude.md](../claude.md) — the canonical long-form operating policy; **overrides everything else** when there is a conflict.
2. [/AGENTS.md](../AGENTS.md) — the Codex/AI bootstrap file that points to `claude.md`.
3. [/.cursor/rules/*.mdc](../.cursor/rules/) — the active Cursor-compatible rules.
4. [/.cursorrules](../.cursorrules) — legacy Cursor compatibility only.
5. [/codex.md](../codex.md) and [/cursor.md](../cursor.md) — human-readable mirrors/reference copies.
6. Root family files (`KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`, `MISTRAL.md`) — compact routers only.
7. [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) — the hard subordinate engineering rules.
8. [/context/architecture-map.md](../context/architecture-map.md) — the subordinate structural source of truth.
9. [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) — the locked runtime, lint, test, and build toolchain.
10. [/rules/README.md](../rules/README.md) — the full numbered rules pack.

> If a role file ever contradicts `claude.md`, the architecture map, or the rules pack, the canon wins. Fix the role file.

---

## Role index

| Role                                                              | One-line mission                                                   | Reach for it when                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [backend-architect](./backend-architect.md)                       | Design modules/boundaries; enforce one-way layering + import rules | Adding a module, splitting a god-file, deciding where code lives |
| [backend-code-reviewer](./backend-code-reviewer.md)               | Run the full review checklist + every quality gate                 | Final gate before a change is declared done                      |
| [backend-security-reviewer](./backend-security-reviewer.md)       | Authn/authz/IDOR/secrets/input review; block tenant gaps           | Any change touching auth, ownership, secrets, input, or routes   |
| [backend-performance-reviewer](./backend-performance-reviewer.md) | Pagination/index/N+1/cache/unbounded-query audit                   | List endpoints, hot paths, loops with awaits, joins              |
| [backend-test-engineer](./backend-test-engineer.md)               | Write/extend Vitest unit + integration tests to the coverage bar   | Any behavior change, new module, or coverage gap                 |
| [backend-refactor-agent](./backend-refactor-agent.md)             | Characterization-tests-first safe refactors; behavior unchanged    | Restructuring code that must keep identical behavior             |
| [backend-release-gatekeeper](./backend-release-gatekeeper.md)     | Final diff + quality-gate + git-safety blocker                     | Before staging, committing, or pushing                           |
| [database-reviewer](./database-reviewer.md)                       | Review queries/migrations/indexes/pagination/injection safety      | Any new query, repository method, migration, or entity index     |
| [observability-reviewer](./observability-reviewer.md)             | Logging/redaction/metrics/diagnosis review                         | Changes touching logs, integrations, background jobs, errors     |
| [reliability-engineer](./reliability-engineer.md)                 | Transactions/idempotency/retry/timeout/shutdown/migration safety   | State mutations, external calls, migrations, startup/shutdown    |

Every role keeps the same shape: **role · mission · inputs · steps · checklist · verdict**.

---

## Shared agent workflow (every role runs this spine)

Each role specializes the same backbone. Run it in order; do not skip steps.

1. **Read the canon.** [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) → [/context/architecture-map.md](../context/architecture-map.md) → [/rules/README.md](../rules/README.md) → the layer rule and [skill](../skills/README.md) for the task.
2. **Inspect the real architecture.** Open the actual files you will touch under `src/`. Never invent paths, contracts, endpoints, fields, permissions, or event names — confirm them in the repo. Use [/context/codebase-navigation.md](../context/codebase-navigation.md).
3. **Write/adjust tests FIRST.** Add or extend the Vitest spec(s) that pin the behavior you are about to add, fix, or refactor — see [backend-test-engineer](./backend-test-engineer.md) and [/testing/testing-strategy.md](../testing/testing-strategy.md).
4. **Make the minimal safe change.** Smallest diff that satisfies the tests and the rules. Respect one-way layering; no drive-by rewrites of unrelated code.
5. **Run every quality gate** (below). All green, no warnings.
6. **Update docs.** If behavior, routes, contracts, data shape, config, or integrations changed, update the affected docs, memory, and any role/rules file in the same change ([/rules/15-review-checklist.md](../rules/15-review-checklist.md)).
7. **Record durable lessons.** A new recurring mistake goes into [/memory/known-pitfalls.md](../memory/known-pitfalls.md); a new convention goes into the relevant [memory](../memory/README.md) file.
8. **Release safely.** Run [backend-release-gatekeeper](./backend-release-gatekeeper.md). Stage explicitly (never `git add .`), never stage secrets or generated output, never bypass hooks.

### Quality gates (toolchain is fixed — never substitute)

Run from the repo root. The exact `package.json` scripts:

```bash
npm run lint            # eslint . — 0 errors AND 0 warnings (incl. the architecture plugin)
npm run typecheck       # tsc --noEmit, project-wide (TypeScript 7 native CLI)
npm run test            # vitest run
npm run test:coverage   # vitest run --coverage — 95% lines/functions/statements, 90% branches, critical paths near 100%
npm run build           # tsc -p tsconfig.build.json, compiles clean
```

Husky enforces a subset automatically:

| Hook         | Runs                        | Purpose                                     |
| ------------ | --------------------------- | ------------------------------------------- |
| `pre-commit` | `lint-staged` + `typecheck` | Block unlintable / untyped staged code      |
| `commit-msg` | `commitlint`                | Conventional Commits message format         |
| `pre-push`   | `test:coverage` + `build`   | Block pushes that fail tests or won't build |

Never bypass hooks (`--no-verify`) and never weaken a gate to make it pass. A green build is **not** proof of correctness — prove behavior with tests.

### Locked toolchain facts (these win over any stale note)

- `@typescript/native` (`npm:typescript@7.0.2`) supplies the TypeScript 7 default `tsc` used for typecheck and build.
- The package named `typescript` (`npm:@typescript/typescript6@6.0.2`) supplies only the compatibility compiler API used by Nest CLI, typescript-eslint, SonarJS, ts-node, and similar tools. This official side-by-side setup is not a downgrade.
- Test runner is **Vitest 4** with `@nestjs/testing` + supertest; coverage provider is **v8** (see `vitest.config.mts` and [/testing/coverage-policy.md](../testing/coverage-policy.md)).
- Validation is **class-validator + class-transformer** (primary); a custom Zod pipe is the documented alternative — [/rules/05-dto-and-validation.md](../rules/05-dto-and-validation.md).
- ORM/database, cache, queue, mailer, and storage are **project choices behind an adapter** — never imported directly outside `adapters/` ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).

---

## Universal guardrails (apply to every role)

No role may relax these. Full text in [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md); the load-bearing summary:

- **Strict types.** No `any`, no `eslint-disable`, no `@ts-ignore`, no `@ts-expect-error` (unless justified in a linked decision file), no `!` non-null assertion, only `===`/`!==`.
- **No magic values / no domain string comparisons.** Statuses, roles, permissions, event names, limits, message keys → enums/constants in dedicated files; compare against enum members.
- **No inline declarations** (types, interfaces, enums, constants, DTOs, request/response shapes, config maps) inside controllers, services, use-cases, repositories, guards, interceptors, pipes, or adapters. Extract to `model/`, `api/dto/`, `lib/`, `@shared/enums`, `@shared/constants`.
- **One-way layering.** Controller (thin, exactly one delegation per method) → Application (use-case for transactional/multi-entity work; service for a focused capability, ≤20 lines/method) → Domain (pure) → Persistence (repository) → Integration (adapter). Use cases call services; services never call use cases.
- **Restricted imports** (enforced by the architecture ESLint plugin): controllers can't import repositories/infrastructure; use-cases can't import controllers/api-DTOs; services can't import controllers; repositories can't import services/use-cases/controllers/api-DTOs; vendor libs only inside adapters; `process.env` only in `config/`/`bootstrap/`.
- **Typed errors.** Every user-facing error throws an `AppError` subclass with a `messageKey` of form `errors.<feature>.<key>`; the global exception filter maps it to an HTTP status + sanitized body. Never leak stacks, secrets, tokens, SQL, or internal errors.
- **Config & logging.** Read typed config via `@nestjs/config`; never `process.env` outside `config/`/`bootstrap/`. Log only via the `@core/logger` adapter; never `console.*`; redact secrets/PII.
- **Validation at the boundary.** All HTTP input flows through a DTO under the global `ValidationPipe` (`whitelist: true`, `transform: true`); validation rules live in the DTO, not the service.
- **Security on every protected route.** Auth guard + permissions (RBAC) guard + ownership/tenant check. Identity comes from the verified token, never the client body.
- **Bounded data access.** No unbounded queries — list endpoints paginate with a hard max limit (cap 100). Parameterized queries only; no raw string interpolation.
- **Fail-safe side effects + terminal states.** Fire-and-forget handlers catch their own errors; retries/timeouts/cancellation are explicit and observable; long-running work reaches success/failure/timeout with operator visibility.
- **No behavior change without tests AND docs** in the same change — written test-first.

---

## Role checklist (before any role reports "done")

- [ ] Canon read: non-negotiable rules → architecture map → relevant layer rule + skill
- [ ] Real files inspected; no invented paths, contracts, or names
- [ ] Tests written/adjusted first; coverage floor met (critical paths near 100%)
- [ ] One-way layering and restricted imports respected
- [ ] All universal guardrails hold in the diff
- [ ] `npm run lint` / `typecheck` / `test` / `test:coverage` / `build` all green
- [ ] Docs, memory, and any affected role/rules file updated in the same change
- [ ] Released via the gatekeeper: explicit staging, no secrets/generated output, hooks not bypassed
- [ ] A clear **PASS / FAIL** verdict with specific, file-anchored findings

**Related:** [/rules/15-review-checklist.md](../rules/15-review-checklist.md) · [/skills/final-validation.md](../skills/final-validation.md) · [/testing/quality-gates.md](../testing/quality-gates.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md) · [/context/architecture-map.md](../context/architecture-map.md)
