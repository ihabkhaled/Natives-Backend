# Enterprise SDLC Operating Brain

> Every request must pass through full business, product, architecture, impact, standards, testing, implementation, QA, security, UAT, risk, documentation, release, hypercare, and retrospective phases with written artifacts and hard gates; no step may be skipped, and no change may ship unless it is reviewed, tested, secure, observable, documented, and operationally reversible.

## Purpose

This file is the permanent operating brain for AI-assisted delivery. It is not a feature document. It is the standing company policy that defines how software work must be classified, analyzed, planned, implemented, validated, documented, released, monitored, and improved.

The point of this file is to remove ambiguity. Nothing important should depend on unstated tribal knowledge, hidden habits, assumed seniority, or optimism.

## Authority And Precedence

If a ticket, sprint note, chat message, verbal request, or local team habit conflicts with this file, this file wins unless an authorized approver records an explicit exception in writing.

This file is policy, not advice.

## Scope

This policy applies to:

- features
- enhancements
- bug fixes
- refactors
- migrations
- integrations
- security fixes
- performance work
- UX changes
- API changes
- database changes
- analytics changes
- workflow changes
- infrastructure changes
- AI behavior changes
- platform changes
- internal tools
- customer-facing systems

## How To Apply This File In Any Codebase

This file is intentionally generic. It must work across languages, frameworks, and architectures.

Map local structures to these generic responsibilities:

- transport layer: controllers, routes, handlers, resolvers, RPC endpoints, actions
- application layer: services, use cases, orchestration flows, commands, workflows
- domain layer: policies, business rules, calculations, invariants, decisions
- data layer: repositories, DAOs, persistence adapters, gateways
- integration layer: third-party clients, SDK wrappers, event publishers, queue consumers
- presentation layer: pages, screens, components, templates, clients
- operational layer: CI/CD, deployment, runtime config, observability, support, runbooks

If the codebase uses different naming, the responsibility still exists even if the class or file names differ.

On case-sensitive filesystems, teams may mirror this file to `CLAUDE.md` if their tooling expects that name. On case-insensitive filesystems, `claude.md` is the canonical file.

## Tool Compatibility And Canonical File Rules

This repository may expose the same policy through multiple tool-facing files, but there is only one canonical long-form source.

1. `claude.md` is the canonical long-form operating policy for this repository.
2. `AGENTS.md` is the Codex-compatible bootstrap file. It must tell Codex to read and follow `claude.md` before doing work.
3. `.cursor/rules/*.mdc` are the Cursor-compatible project rules. They must remain aligned with `claude.md`.
4. `.cursorrules` may exist only as a legacy compatibility shim for older Cursor setups and must not become the richer source of truth.
5. `codex.md` and `cursor.md` are mirror/reference copies for humans or custom tooling. If they ever diverge from `claude.md`, `claude.md` wins.
6. `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`, and `MISTRAL.md` are compact dedicated entrypoints for their respective AI agent families. If they ever diverge from `claude.md`, `claude.md` wins. `codex.md` already fulfills the full GPT/Codex/Sol mirror role; no additional full GPT mirror is needed.
7. When any permanent policy changes, update the canonical file first, then update compatibility and mirror files in the same delivery stream.

## NestJS Engineering Operating System (The Concrete "How")

This file is the **stack-agnostic governance brain**: it defines _which phases, artifacts, and gates_ every change must pass through. Layered on top of it is a **concrete NestJS engineering operating system** that defines _exactly how the code must be written_ for any NestJS backend. The two are complementary and both binding: governance decides whether you may ship; the engineering OS decides whether the code is correct, clean, layered, and safe.

For any NestJS backend work, these layers are authoritative for implementation and are mechanically enforced by [`eslint.config.mjs`](eslint.config.mjs) (including a custom architecture plugin under [`eslint/`](eslint/)), [`tsconfig.json`](tsconfig.json), and the Husky hooks under [`.husky/`](.husky/):

| Layer                         | Location                        | Authority                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engineering rules             | [`rules/`](rules/README.md)     | How code in each layer must be written; starts with [`rules/00-non-negotiable-rules.md`](rules/00-non-negotiable-rules.md)                                                                                   |
| Task playbooks                | [`skills/`](skills/README.md)   | Step-by-step procedures that apply the rules                                                                                                                                                                 |
| AI / human context            | [`context/`](context/README.md) | The [architecture map](context/architecture-map.md), [stack & toolchain](context/stack-and-toolchain.md), [task router](context/codebase-navigation.md), [reference patterns](context/reference-patterns.md) |
| Durable decisions             | [`memory/`](memory/README.md)   | Standing decisions + the [learned-pitfalls log](memory/known-pitfalls.md)                                                                                                                                    |
| Review roles                  | [`agents/`](agents/README.md)   | Specialist reviewers (architecture, security, performance, tests, database, reliability, release)                                                                                                            |
| Testing standards             | [`testing/`](testing/README.md) | Engineering test strategy, layers, coverage, fixtures, gates                                                                                                                                                 |
| Lint/architecture enforcement | [`eslint/`](eslint/)            | The modular ESLint configs + custom layer-boundary plugin                                                                                                                                                    |

The canonical architecture (one-way layered dependencies, mechanically enforced):

```
Controller (api/*.controller.ts — thin, one delegation per method)
  → Application (application/*.use-case.ts — orchestration + transactions; *.service.ts — focused, ≤20 lines/method)
    → Domain (domain/ — policies, entities, state machines, pure)
      → Persistence (infrastructure/*.repository.ts — parameterized, bounded)
        → Integration (adapters/*.adapter.ts — every external library wrapped)
Cross-cutting: src/core (logger, errors+exception filter, guards, interceptors, pipes, events) · src/config · src/shared
```

Precedence within the engineering OS: [`context/architecture-map.md`](context/architecture-map.md) and [`rules/00-non-negotiable-rules.md`](rules/00-non-negotiable-rules.md) are the engineering canon; if any other engineering doc contradicts them, those two win. If any engineering guidance contradicts this `claude.md` governance policy, `claude.md` wins. When two rules overlap, the stricter one applies. New permanent engineering rules update `rules/` (and the mirrors per the canonical-file rules above); new lifecycle/governance rules update this file.

Before NestJS implementation: read this `claude.md`, then [`context/architecture-map.md`](context/architecture-map.md), [`rules/00-non-negotiable-rules.md`](rules/00-non-negotiable-rules.md), the layer rule(s) you are touching, and the matching skill — then write tests first and keep every gate green (`npm run lint` · `npm run typecheck` · `npm run test:coverage` · `npm run build`).

The current repository toolchain is Node.js 24.18.0 LTS with npm >=11.16.0 and Microsoft's official TypeScript 7 side-by-side migration: `@typescript/native` (`npm:typescript@7.0.2`) owns the default `tsc` used by typecheck/build, while the package named `typescript` (`npm:@typescript/typescript6@6.0.2`) exists only for tools that import the compiler API. This compatibility package is not a downgrade. The authoritative details live in [`context/stack-and-toolchain.md`](context/stack-and-toolchain.md).

Before writing code, run the IronNest Simple Code Ladder ([`rules/20-simple-readable-code.md`](rules/20-simple-readable-code.md), non-negotiable rules 43–46): need it → reuse existing → native/platform → existing adapter/dependency → small helper → direct readable code → new abstraction only when justified. Be lazy about code volume, never lazy about reading, validation, security, auth, permissions, ownership checks, tests, docs, observability, or architecture.

> **The best backend code is the code the next developer understands immediately.** Minimal code means minimum safe code. The complete readability/refactor/declaration/agent canon is [`rules/20`](rules/20-simple-readable-code.md)–[`rules/30`](rules/30-declaration-ownership.md), routed by [`context/simple-code-map.md`](context/simple-code-map.md), [`context/refactor-navigation.md`](context/refactor-navigation.md), and [`context/declaration-ownership-map.md`](context/declaration-ownership-map.md). Layer signatures do not hide anonymous contracts; DTOs use declarations rather than definite-assignment assertions; broad refactors are tests-first and responsibility-sliced.

## Standing Instruction To Claude Or Any AI Coding Agent

You are operating inside a strict enterprise SDLC. This workflow is mandatory and must never be skipped, compressed away, ignored, or bypassed, even for small changes. Depth may scale by request size, but every phase and gate must still exist.

Whenever you receive a request, you must:

1. classify the request
2. document the phases in order
3. surface assumptions instead of hiding them
4. surface risk instead of hand-waving it
5. implement only after phases `00` through `13` are documented
6. validate through the correct test layers
7. update documentation with the change
8. refuse to label incomplete work as done

If information is missing, do not stop by default. Make the best reasonable assumptions, label them clearly, record the risk, and continue until a real blocker exists.

## General Operating Rules

1. Never skip any phase.
2. Never jump directly to implementation.
3. Always start with request intake, business analysis, product framing, architecture review, impact review, standards review, and test planning.
4. Always document every phase in the correct artifact.
5. Always update `claude.md` and any uppercase compatibility mirror if a new permanent rule, workflow, standard, architecture constraint, testing expectation, release rule, or quality gate is discovered.
6. Always prefer small, reviewable changes over large, opaque changes.
7. Always keep tests in the same delivery stream as the behavior they validate.
8. Always keep docs in the same delivery stream as the behavior they explain.
9. Always measure coverage on touched modules, not only repository-wide averages.
10. Always review blast radius before changing code.
11. Always make changes observable, supportable, and reversible.
12. Always expose assumptions, risks, open questions, and dependencies explicitly.
13. Never treat compile success as proof of correctness.
14. Never treat a passing happy path as adequate validation.
15. Never treat undocumented behavior as complete implementation.
16. Never treat a bug as fixed when only the visible symptom disappeared.
17. Never hide missing work behind vague wording such as "mostly done" or "follow-up later."
18. Never skip documentation because the request looks small.
19. Never skip rollback thinking because the request looks safe.
20. Never leave support, operations, QA, or security surprised by a release.

## Mandatory Read-Before-Acting Sequence

Before doing analysis or implementation work, the assigned engineer or AI agent must:

1. read this root `claude.md`
2. read the request artifacts if the request already exists
3. read relevant architecture docs, ADRs, standards, and runbooks
4. read the code that will be modified before changing it
5. read existing tests for the affected area before adding or changing behavior
6. read recent incidents, bug reports, and support signals if the request is related to a known issue
7. read deployment, config, security, or routing docs if the change touches runtime or exposure concerns

No one should modify code they have not read.

## Required Output Order For Every Request

Whenever an AI agent responds to a request, it must organize the work in this order:

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
13. Implementation plan or code work only after phases `00` through `13` are documented

If implementation work is completed in the same response, also include:

14. changed files summary
15. validation evidence summary
16. documentation updates summary
17. known gaps, waivers, blockers, or follow-up items

## Mandatory Repository Structure

```text
# Governance & SDLC
/claude.md                              # canonical operating brain (this file)
/AGENTS.md /codex.md /cursor.md         # cross-tool + mirror entrypoints
/KIMI.md /GEMINI.md /GLM.md /QWEN.md /DEEPSEEK.md /MISTRAL.md   # per-model routers
/.cursor/rules/                         # IDE-native project rules
/.cursorrules (optional legacy compatibility)
/docs/sdlc/                             # permanent SDLC baselines (incl. exceptions-register.md)
/docs/features/<feature-slug>/          # per-request phase artifacts
/test-cases/ /runbooks/ /release-notes/ /support/
/architecture/adrs/                     # decision records

# Engineering operating system (the concrete "how")
/rules/                                 # numbered engineering rules (00–30)
/skills/                                # step-by-step task playbooks
/context/                               # architecture/navigation/simplicity maps
/memory/                                # durable decisions + known pitfalls
/agents/                                # specialist reviewer roles
/testing/                               # testing standards + coverage policy
/eslint/                                # flat configs + custom architecture plugin

# Compiled AI acceleration plane (generated)
/tools/knowledge/                       # the generator + resolver + benchmark/verify gates
/.ai/                                   # BOOTSTRAP.md + manifests (committed; .ai/local/ is not)
```

The canonical request artifacts are:

- `00-intake.md`
- `01-business-analysis.md`
- `02-business-development.md`
- `03-product-requirements.md`
- `04-cross-functional-refinement.md`
- `05-delivery-plan.md`
- `06-technical-refinement.md`
- `07-technical-roadmap.md`
- `08-architecture-review.md`
- `09-impact-analysis.md`
- `10-engineering-standards-check.md`
- `11-test-strategy.md`
- `12-coverage-plan.md`
- `13-implementation-readiness.md`
- `15-dev-validation-report.md`
- `16-dev-bug-log.md`
- `17-qa-report.md`
- `18-defect-cycle-log.md`
- `19-threat-model.md`
- `19-security-review.md`
- `19-pentest-report.md`
- `20-uat-report.md`
- `21-client-approval.md`
- `22-go-no-go.md`
- `23-documentation-changelog.md`
- `24-risk-compliance-ops.md`
- `25-release-report.md`
- `26-hypercare-report.md`
- `27-retrospective.md`
- `27-postmortem.md` when applicable

Phase `14` is implementation and does not require a standalone markdown artifact because the artifacts are the code, tests, migrations, observability assets, and documentation created during the change.

## Artifact Rules

1. If a section is not applicable, write `Not applicable`, explain why, and name who accepted that conclusion.
2. Do not leave silent blanks for meaningful sections.
3. Keep assumptions visible until resolved or explicitly accepted.
4. Link related tickets, dashboards, pull requests, ADRs, incident IDs, and evidence where useful.
5. Update artifacts during the phase, not from memory after the fact.
6. Treat artifacts as living records, not ceremony.

## Minimum Document Contents By Artifact

Each request artifact must contain at least the following:

- `00-intake.md`: request ID, title, type, source, owners, severity, urgency, affected domains, delivery track, critical-risk flags, initial scope statement
- `01-business-analysis.md`: problem statement, stakeholders, personas, current state, desired state, business goals, success metrics, assumptions, dependencies, risks of not doing the work
- `02-business-development.md`: commercial value, target segment or accounts, contract or SLA impact, rollout audience, adoption risks, enablement notes
- `03-product-requirements.md`: epics, user stories, acceptance criteria, in-scope items, out-of-scope items, non-goals, UX expectations, error states, permissions expectations, analytics expectations, localization expectations, product definition of done
- `04-cross-functional-refinement.md`: participant list, findings by function, hidden work, integration points, missing requirements, open questions, decisions, owners
- `05-delivery-plan.md`: workstreams, milestones, sequence, dependencies, blockers, approvals, rollout strategy, risk list
- `06-technical-refinement.md`: technical context, alternatives considered, trade-offs, chosen approach, rejected approaches, open technical questions, debt impact
- `07-technical-roadmap.md`: engineering milestones, branch and merge strategy, schema evolution plan, rollout sequence, rollback sequence, flag and compatibility notes
- `08-architecture-review.md`: current architecture context, impact by area, boundary changes, contract changes, data-flow changes, ADR decision, architecture risks
- `09-impact-analysis.md`: affected systems, affected teams, backward compatibility, migration needs, monitoring impact, support impact, training impact, compliance impact
- `10-engineering-standards-check.md`: standards review matrix, request-specific rules, permanent-rule update check, implementation constraints
- `11-test-strategy.md`: requirement-to-test mapping, test layers, negative and edge cases, migration and rollback tests, environment needs, evidence plan, linked test-case locations
- `12-coverage-plan.md`: touched modules, required thresholds, critical scenario areas, evidence plan, waiver status
- `13-implementation-readiness.md`: branch strategy, slices, flags, config changes, migration plan, rollback plan, observability plan, review readiness, release readiness, open readiness gaps
- `15-dev-validation-report.md`: validation summary, commands or activities run, functional coverage, operational checks, acceptance-criteria validation, defects found
- `16-dev-bug-log.md`: bug table, severity, owner, fix status, retest status, regression rerun notes, stability decision
- `17-qa-report.md`: QA inputs, scenario matrix, API validation, UI validation, end-to-end validation, findings, QA decision
- `18-defect-cycle-log.md`: defect list, fix cycle status, retest status, regression status, behavior changes during fixes, return-to-QA notes
- `19-threat-model.md`: scope, assets, trust boundaries, threat scenarios, abuse cases, mitigations, residual risk
- `19-security-review.md`: security checklist coverage, findings, waivers, decision, reviewer, date
- `19-pentest-report.md`: scope, techniques used, executed cases, findings, residual risk, remediation ownership
- `20-uat-report.md`: UAT participants, scenarios, business fit assessment, findings, UAT decision
- `21-client-approval.md`: review package shared, client feedback, approval status, conditions, notes
- `22-go-no-go.md`: readiness review by area, remaining risks, final decision, decision owner, conditions
- `23-documentation-changelog.md`: all updated documents, why each changed, remaining documentation gaps, owners
- `24-risk-compliance-ops.md`: reviewer list, review areas, status, findings, final readiness decision
- `25-release-report.md`: release summary, deployment steps executed, smoke-test results, production checks, issues during release, final status
- `26-hypercare-report.md`: hypercare window, observed signals, actions taken, conclusion, follow-ups
- `27-retrospective.md`: what went well, what did not, process improvements, engineering improvements, documentation improvements, follow-up actions, `claude.md` update needs
- `27-postmortem.md`: incident summary, impact, timeline, root cause, contributing factors, detection review, corrective actions, policy and process changes

## Phase Policy

### Phase 0 - Request Intake And Classification

Purpose: classify the request before solutioning begins.

What must happen:

- assign a unique request ID
- classify request type
- identify affected domains
- assess severity and urgency
- decide whether this is standard track or hotfix track
- identify whether money flow, auth, permissions, privacy, tenant isolation, compliance, external integrations, reporting, or critical workflows are touched
- assign owners

Required artifact: `00-intake.md`

Exit criteria:

- the request is classified
- the request has owners
- the request has an initial scope statement
- the request criticality is visible

### Phase 1 - Business Analysis

Purpose: define the actual business problem before implementation details take over.

What must happen:

- define the real business pain
- identify stakeholders and affected user groups
- describe current state and desired state
- define measurable success metrics
- document assumptions, dependencies, and consequences of not delivering

Required artifact: `01-business-analysis.md`

Exit criteria:

- business intent is explicit
- business value is stated
- success is measurable

### Phase 2 - Business Development / Commercial Impact

Purpose: confirm the request makes sense commercially, strategically, and contractually.

What must happen:

- evaluate commercial value
- define target audience or rollout audience
- review contract or SLA implications
- identify adoption and enablement risk

Required artifact: `02-business-development.md`

Exit criteria:

- commercial or strategic justification exists
- rollout audience is defined
- contract risk is visible

### Phase 3 - Product Requirements

Purpose: translate business intent into product behavior.

What must happen:

- define epics and user stories
- define acceptance criteria
- define scope boundaries and non-goals
- define UX, permission, notification, analytics, localization, and error-state expectations
- define product-level definition of done

Required artifact: `03-product-requirements.md`

Exit criteria:

- requirements are testable
- scope boundaries are visible
- product behavior is explicit

### Phase 4 - Cross-Functional Refinement

Purpose: surface hidden work before implementation planning hardens.

What must happen:

- review with engineering, QA, security, DevOps or SRE, support, analytics, and any other impacted function
- surface missing requirements
- identify integration points and support impact
- identify observability, migration, and permission implications

Required artifact: `04-cross-functional-refinement.md`

Exit criteria:

- hidden work is exposed
- missing requirements are captured
- cross-functional concerns are visible

### Phase 5 - Delivery Planning

Purpose: convert the request into an executable plan.

What must happen:

- break work into milestones and workstreams
- assign owners
- sequence dependencies
- identify blockers
- identify required approvals
- define rollout approach

Required artifact: `05-delivery-plan.md`

Exit criteria:

- there is a realistic path to delivery
- dependencies and blockers are visible
- workstreams are owned

### Phase 6 - Technical Refinement

Purpose: choose the technical direction deliberately.

What must happen:

- evaluate implementation alternatives
- compare simplicity, maintainability, scalability, performance, security, cost, reliability, and compatibility
- choose an approach and explain why
- record rejected alternatives
- record open technical questions

Required artifact: `06-technical-refinement.md`

Exit criteria:

- technical direction is selected
- trade-offs are documented
- rejected options are documented

### Phase 7 - Technical Roadmap

Purpose: define engineering execution slices.

What must happen:

- define incremental milestones
- define branch and merge strategy
- define schema evolution order
- define rollout order
- define rollback order
- prefer small reviewable slices instead of large entangled changes

Required artifact: `07-technical-roadmap.md`

Exit criteria:

- implementation order is explicit
- merge and release sequencing are explicit
- rollback sequencing is explicit

### Phase 8 - Architecture Review

Purpose: ensure the solution fits the current architecture or intentionally evolves it with traceability.

What must happen:

- review architecture docs, domain boundaries, ownership, workflows, and contracts
- identify data-flow and topology impact
- identify required ADRs
- identify intentional deviations and why they are acceptable

Required artifact: `08-architecture-review.md`

Exit criteria:

- architecture fit is documented
- required ADR decisions are made
- ownership impact is visible

### Phase 9 - Full Impact Analysis

Purpose: expose the full blast radius so no team is surprised later.

What must happen:

- review impact across engineering, QA, security, analytics, reporting, DevOps or SRE, documentation, support, operations, monitoring, release engineering, and customer success
- review backward compatibility
- review migration needs
- review support and training implications
- review privacy and compliance implications

Required artifact: `09-impact-analysis.md`

Exit criteria:

- affected systems are identified
- affected teams are identified
- compatibility and migration impacts are documented

### Phase 10 - Engineering Standards Review

Purpose: freeze the implementation rules before coding.

What must happen:

- review architecture boundaries
- review code quality expectations
- review logging and observability rules
- review accessibility and localization expectations
- review secure coding expectations
- identify request-specific rules
- update `claude.md` if a new lasting standard is discovered

Required artifact: `10-engineering-standards-check.md`

Exit criteria:

- implementation constraints are explicit
- standards are visible to everyone doing the work
- any permanent-rule update decision is recorded

### Phase 11 - Test Strategy

Purpose: design quality before implementation starts.

What must happen:

- map requirements and risks to test layers
- define unit, integration, contract, UI, UX, E2E, regression, migration, rollback, permission, analytics, and security tests
- define environments and test data
- define evidence expectations

Required artifact: `11-test-strategy.md`

Exit criteria:

- testing is comprehensive enough for the risk
- test layers are mapped to requirements and risks
- environments and evidence expectations are defined

### Phase 12 - Coverage Strategy

Purpose: define the measurable coverage gate.

What must happen:

- define touched-module coverage thresholds
- define critical scenario areas
- define how coverage will be measured and reviewed
- record waivers if needed

Required artifact: `12-coverage-plan.md`

Exit criteria:

- coverage expectations are enforceable
- touched modules are identified
- waiver status is documented

### Phase 13 - Implementation Readiness

Purpose: prepare safely before coding.

What must happen:

- confirm phases `00` through `12` are sufficient to begin
- prepare branch strategy
- prepare flags and config changes
- prepare migrations and rollback
- prepare observability
- prepare review and test scaffolding
- identify release controls and approvers

Required artifact: `13-implementation-readiness.md`

Exit criteria:

- the team can start implementation safely
- major readiness gaps are either closed or explicitly accepted

### Phase 14 - Implementation

Purpose: implement according to the approved plan.

What must happen:

- implement in small, reviewable slices
- keep tests with the code whenever possible
- keep docs with the code whenever behavior changes
- respect architecture and module boundaries
- add observability, resilience, validation, and error handling as part of implementation
- keep rollback and supportability in view

Required artifacts:

- code
- tests
- migrations or data change scripts when needed
- observability updates when needed
- documentation updates when needed
- release notes draft when behavior is user-visible or operator-visible

Exit criteria:

- implementation is complete and internally coherent
- implementation artifacts exist alongside the change

### Phase 15 - Developer Validation

Purpose: the implementation team proves its own work before handoff.

What must happen:

- run linting
- run type checks or language-appropriate static analysis
- run unit tests
- run integration tests
- run E2E tests where applicable
- run manual exploratory validation
- validate logs, metrics, state transitions, jobs, queues, retries, and acceptance criteria

Required artifact: `15-dev-validation-report.md`

Exit criteria:

- the team can credibly say the feature works before QA sees it
- evidence exists for the validations performed

### Phase 16 - Internal Bug Loop

Purpose: the implementation team must find and fix its own defects aggressively.

What must happen:

- track defects
- classify severity
- fix defects
- re-test fixes
- re-run regression
- repeat until internally stable

Required artifact: `16-dev-bug-log.md`

Exit criteria:

- internal blocking defects are zero or explicitly accepted with approval
- stability status is recorded

### Phase 17 - Independent QA Validation

Purpose: independent validation of product intent and implementation behavior.

What must happen:

- validate APIs, UI, flows, permissions, data behavior, edge cases, and regression scope
- validate end-to-end workflows
- verify the system matches requirements and real usage expectations

Required artifact: `17-qa-report.md`

Exit criteria:

- QA signs off or returns defects

### Phase 18 - QA Defect Loop

Purpose: send QA-found defects back through the full engineering quality cycle.

What must happen:

- fix defects
- add or update tests
- re-run relevant automation
- update docs when behavior changes
- return to QA
- repeat until QA signs off

Required artifact: `18-defect-cycle-log.md`

Exit criteria:

- a QA-approved build exists

### Phase 19 - Security Testing And AppSec Review

Purpose: validate security, privacy, abuse resistance, and operational security.

What must happen:

- threat model the change
- review authentication and authorization
- review secrets handling
- review input validation and output safety
- review abuse controls and rate limits
- review data handling, logging leakage, and privacy boundaries
- review dependency and CI/CD risk
- perform dynamic validation when the risk warrants it

Required artifacts:

- `19-threat-model.md`
- `19-security-review.md`
- `19-pentest-report.md`

Exit criteria:

- no unresolved critical or high-risk issue remains unless explicitly waived by authorized leadership

### Phase 20 - UAT / Business Testing

Purpose: validate the solution against real business use.

What must happen:

- validate practical workflows
- validate wording and operator usability
- validate business rules and reporting expectations
- validate whether the original pain is actually solved

Required artifact: `20-uat-report.md`

Exit criteria:

- business owner signs off or rejects

### Phase 21 - Client Testing And Approval

Purpose: obtain external stakeholder approval when needed.

What must happen:

- provide release notes, demo path, known constraints, and approval checklist
- capture feedback and change requests
- route defects back through implementation, QA, security, and UAT as needed

Required artifact: `21-client-approval.md`

Exit criteria:

- client approves or formally defers approval

### Phase 22 - Go / No-Go Governance

Purpose: perform the formal release gate decision.

What must happen:

- review scope delivered
- review open defects
- review risk
- review rollback readiness
- review support and observability readiness
- review migration readiness
- review compliance and approval status
- record a clear GO or NO-GO decision

Required artifact: `22-go-no-go.md`

Exit criteria:

- signed release decision exists

### Phase 23 - Documentation And Knowledge Updates

Purpose: update institutional memory before release, not later.

What must happen:

- update `claude.md`
- update architecture docs
- update API and contract docs
- update runbooks
- update support docs
- update QA and security docs
- update onboarding and migration docs
- update release notes
- update user docs when behavior changed

Required artifact: `23-documentation-changelog.md`

Exit criteria:

- documentation is current enough for engineering, QA, security, support, and operations

### Phase 24 - Risk / Compliance / Operational Readiness

Purpose: confirm enterprise readiness before release.

What must happen:

- review business, technical, security, privacy, legal, operational, and reputational risk
- confirm monitoring and alerting
- confirm escalation paths
- confirm support readiness
- confirm compliance and policy implications

Required artifact: `24-risk-compliance-ops.md`

Exit criteria:

- risks are accepted, mitigated, or blocked explicitly

### Phase 25 - Release And Delivery

Purpose: deploy in a controlled way.

What must happen:

- release using the approved strategy
- execute smoke tests
- validate logs, metrics, traces, data behavior, and integration behavior
- keep rollback ready

Required artifact: `25-release-report.md`

Exit criteria:

- production release is complete and stable

### Phase 26 - Hypercare

Purpose: confirm success under real traffic and real use.

What must happen:

- monitor incidents, errors, latency, retries, support tickets, adoption, and KPIs
- validate SLO or operational impact where relevant
- patch or roll back quickly if needed

Required artifact: `26-hypercare-report.md`

Exit criteria:

- the release is operationally healthy

### Phase 27 - Retrospective And Postmortem

Purpose: convert delivery into organizational learning.

What must happen:

- run a retrospective for every release
- run a blameless postmortem for serious defects, failed releases, or incidents
- record what must change in standards, docs, architecture, tests, support, onboarding, or `claude.md`

Required artifacts:

- `27-retrospective.md`
- `27-postmortem.md` when applicable

Exit criteria:

- the organization got better, not just the feature shipped

## Cross-Phase Rules

These rules apply throughout the entire lifecycle:

1. Depth may scale by request size; phase existence may not.
2. Hotfixes may compress timing; they may not erase traceability.
3. Every major decision must have a clear owner.
4. Every assumption must have a risk interpretation.
5. Every open question must be tracked until resolved or explicitly accepted.
6. Every change with behavior impact must update docs.
7. Every change with operational impact must update runbooks and support context.
8. Every change with architecture impact must update architecture docs and possibly ADRs.
9. Every change with security impact must pass security review appropriate to the risk.
10. Every change with user-facing impact must pass real user-flow validation, not only isolated technical tests.

## Mandatory Pre-Implementation Gate

Before phase `14` starts, all of the following must be true:

- [ ] root `claude.md` reviewed
- [ ] related feature folder exists or is updated
- [ ] business, product, architecture, impact, standards, test, and coverage phases documented
- [ ] related code read and understood
- [ ] related tests read and understood
- [ ] rollout and rollback approach documented
- [ ] observability needs identified
- [ ] documentation scope identified
- [ ] major risks identified
- [ ] owners assigned

If any item is false, implementation must not start.

## Universal Engineering Rules

### Universal Code Rules

These rules are intentionally language-agnostic. Use the equivalent enforcement mechanism in the local stack.

1. Do not introduce unsafe typing or unchecked dynamic behavior when a safer contract is available.
2. In typed languages, avoid `any`-style escape hatches except in tightly justified boundaries.
3. Do not disable linters, static analyzers, or security checks without explicit justification and approval.
4. Do not compare domain values with ad hoc raw strings when shared enums, constants, schemas, or value objects exist.
5. Do not leak secrets, tokens, credentials, or protected data to logs, clients, analytics, traces, or error messages.
6. Do not scatter environment reads throughout business logic; use a validated configuration layer or equivalent.
7. Do not build god-files or god-classes; keep modules focused and legible.
8. Do not hide core behavior in giant utility files.
9. Do not leave critical behavior dependent on implicit defaults that reviewers cannot see.
10. Do not place business rules in thin transport or rendering layers.
11. Do not place persistence logic in UI, transport, or domain-policy layers unless the architecture explicitly requires it and documents it.
12. Do not let one domain mutate another domain's private data store without a documented ownership model.
13. Do not swallow errors silently.
14. Do not create fire-and-forget workflows with no visible success or failure outcome.
15. Do not leave long-running workflows without terminal states, timeout logic, and operator visibility.
16. Do not add behavior without tests.
17. Do not add user-facing text without localization support when the product supports localization.
18. Do not add hidden coupling to external libraries; wrap third-party behavior behind local adapters when it affects core workflows.
19. Do not leave return behavior ambiguous in public interfaces.
20. Do not leave reviewers guessing where the real logic lives.

### Zero Inline Definitions Policy

The default rule is simple: reusable structure must not live inline in logic or presentation files.

1. Do not define interfaces, types, enums, domain constants, request contracts, response contracts, schemas, policy maps, permission maps, event names, queue names, or configuration objects inline inside presentation files, handlers, controllers, routes, services, use cases, managers, repositories, adapters, middleware, guards, pipes, filters, interceptors, or hooks. Anonymous type literals in parameters, returns, and generics are inline contracts too.
2. Move shared structure into dedicated files with clear ownership, such as:
   - `types` or `model` for types and interfaces
   - `enums` for domain enums
   - `constants` or `config` for shared constants and configuration maps
   - `contracts`, `dto`, or `schema` for request and response shapes
   - `utilities`, `helpers`, `formatters`, `builders`, `mappers`, `transformers`, or `policies` for named logic
3. Do not leave repeated inline anonymous functions when a named function would make ownership and reuse clearer.
4. Inline definitions are acceptable only for truly tiny method-local values or one-use framework call options that carry no domain/security policy and are clearer at the call site. Implementation-layer module declarations and anonymous contracts are never covered by this exception. DTO fields use `declare`/constructor assignment, never definite-assignment `!`.
5. In presentation files, the standard is stricter: no inline types, no inline enums, no inline schemas, no inline reusable constants, no inline business logic, and no inline helpers.

### Shared Library Encapsulation Rules

Any third-party library that matters to product behavior, architecture, security, rendering, transport, storage, or infrastructure must be wrapped behind a local reusable abstraction.

1. Do not import third-party libraries ad hoc throughout the app when they represent a reusable concern.
2. Create a common module, wrapper, adapter, gateway, service, utility, or shared UI component so the rest of the codebase depends on your internal interface rather than the vendor API directly.
3. Frontend or presentation libraries must be wrapped in reusable common UI components or shared utilities when used across multiple screens or flows.
4. Backend, infrastructure, or integration libraries must be wrapped in shared modules, common services, or adapters with well-defined public methods.
5. The purpose of wrapping is:
   - centralized configuration
   - centralized security hardening
   - consistent error handling
   - easier test doubles and mocks
   - easier replacement if the library changes later
6. If a library can reasonably be swapped without rewriting the whole app, the swap surface should be your wrapper, not hundreds of direct imports.
7. Common wrappers and modules must be documented. Each one should explain:
   - what concern it owns
   - which underlying library or provider it wraps
   - what public API it exposes
   - how it should be used
   - what must be updated if the underlying library changes

### Package And Toolchain Compatibility Rules

1. Prefer the latest stable packages that are compatible with the supported runtime, framework, peer contracts, and security baseline.
2. For major-version migrations, use the vendor's official migration path, compatibility package, adapter, or supported side-by-side arrangement.
3. Do not silently downgrade the primary runtime, language, framework, or quality tooling, and do not weaken gates to make dependency resolution appear successful. Any deliberate compatibility package or pin must have a documented owner and purpose.
4. Treat lockfiles as package-manager-generated integrity artifacts. Never hand-edit dependency, package, or peer metadata in a lockfile to claim compatibility.
5. Do not use or recommend `--force`, `--legacy-peer-deps`, or an `.npmrc` legacy-peer bypass to manufacture a green install.
6. A successful dependency solve does not prove runtime API compatibility. After dependency or migration changes, validate a clean install and run the affected lint, type, test, and build gates.

### Frontend And Presentation Layer Discipline

Apply these rules to UI files, pages, screens, components, templates, view controllers, hooks, view models, and client services in any frontend architecture.

1. Presentation files should be composition-first and logic-light.
2. Do not place business rules, API orchestration, validation logic, transformation logic, or domain-policy logic in UI rendering files.
3. Move stateful or orchestration logic into dedicated controller hooks, presenters, view models, or equivalent presentation-controller files.
4. Presentation files should receive ready-to-render values, simple handlers, and stable view state.
5. Shared UI behavior should be implemented once in common components rather than re-created ad hoc in every screen.
6. Do not import third-party UI libraries directly in many screens if a shared wrapper component can own them centrally.
7. Standardize core UI building blocks, such as:
   - buttons
   - inputs
   - selects
   - textareas
   - dialogs
   - notifications
   - tables or grids
   - loaders
   - empty states
   - error states
   - form fields
8. If the codebase supports localization, all user-facing text must route through the localization system, not raw inline strings.
9. Domain values in presentation logic must use canonical enums or constants, not ad hoc string comparisons.
10. Presentation-layer helper logic longer than 2-3 cohesive lines should become a named helper, formatter, mapper, or presenter method in a dedicated file.

### Hook, Presenter, And View-Model Rules

If the codebase uses hooks, presenters, view models, or controller objects:

1. One file should usually own one primary hook, presenter, or view model.
2. These files should orchestrate, not become dumping grounds.
3. Keep them short, readable, and responsibility-focused.
4. Extract non-trivial transformations, guards, status mapping, formatting, and reusable calculations into dedicated helper files.
5. Do not define reusable types, schemas, enums, or constants inline in hook or presenter files.
6. Prefer returning a clean interface of:
   - values
   - derived view state
   - user actions
   - loading status
   - error status
7. Derived state should usually be prepared here rather than recomputed repeatedly in rendering files.

### Backend, Service, Use-Case, And Manager Discipline

Apply these rules to application services, use cases, managers, orchestrators, facades, command handlers, workflow services, and similar logic layers.

1. These layers are orchestration layers, not dumping grounds.
2. Keep methods short and readable.
3. As a default rule, every 2-5 cohesive lines of transformation, validation, mapping, formatting, or branch-heavy logic should be extracted to a named function in a dedicated helper, policy, mapper, builder, formatter, or utility file.
4. A service or use-case method should read like a recipe:
   - validate preconditions
   - call the needed collaborators
   - coordinate side effects
   - return the result
5. Do not bury string manipulation, data shaping, validation rules, permission matrices, event payload building, or formatting rules inline in service methods.
6. Complex business rules belong in policy, rule, domain, or validator files.
7. Complex data shaping belongs in mappers, builders, serializers, or transformers.
8. Service and use-case files should not instantiate infrastructure libraries directly when shared modules or adapters can provide them.
9. If a service method becomes long, highly nested, or hard to name, it is already telling you extraction is overdue.

### Handler, Controller, Route, And Transport Discipline

Apply these rules to HTTP handlers, controllers, routes, RPC handlers, message handlers, CLI commands, and other transport or delivery entry points.

1. Transport layers should parse input, invoke the correct application service, and return the response.
2. Keep handlers thin.
3. Avoid business logic, heavy transformation, and multi-step orchestration in the transport layer.
4. Transport code should not be the hidden home of validation, mapping, permissions, retries, or side-effect coordination unless the architecture explicitly requires it and documents it.
5. Prefer one primary application call per handler unless orchestration at that boundary is explicitly justified.

### Repository, DAO, And Persistence Discipline

1. Persistence layers should be pure data-access layers.
2. They should not own business policy, permission policy, or user-facing transformation logic.
3. They should not bury hidden side effects.
4. They should expose clear query and mutation methods with stable contracts.
5. Multi-tenant or ownership boundaries must be enforced deliberately in persistence access paths where that layer is responsible for scoping.
6. If repository logic becomes full of business branching, the ownership model is probably wrong and needs refactoring.

### Generic Equivalents Of Lint And Static Analysis Rules

Translate strict linting and static-analysis discipline into these universal coding rules:

#### Type and contract discipline

- prefer explicit return types on public functions, methods, handlers, services, repositories, utilities, and exported callbacks
- do not use weak escape hatches when a stronger type or contract exists
- do not leave unused variables, parameters, imports, or branches in production code unless intentionally marked and documented
- do not shadow outer-scope names when it harms readability
- do not use unchecked null assertions or equivalent shortcuts
- require exhaustive handling for enums, tagged unions, or state machines

#### Control-flow discipline

- use strict and explicit comparisons
- do not rely on implicit coercion for boolean, numeric, or string conversion when an explicit conversion is clearer
- avoid nested ternaries
- avoid deep nesting; prefer guard clauses and early returns
- use braces for multi-line branches and loops
- do not assign inside return statements or control-flow conditions
- do not write unreachable or contradictory branches
- do not compare a value to itself unless that is the explicit intended technique and the language requires it
- do not define loop-capturing closures carelessly when they can produce subtle bugs

#### Promise, task, and async discipline

- do not ignore asynchronous work silently
- every async operation must be awaited, joined, observed, or explicitly detached with deliberate error handling
- do not await inside loops when operations are independent and can be batched safely
- do not create asynchronous functions that pretend to be async but never perform async work unless the interface requires it and the reason is documented
- do not leave retries, cancellations, or timeouts implicit

#### Data and mutation discipline

- do not mutate function parameters casually
- prefer immutability where it improves correctness and readability
- prefer explicit object construction and clear merge behavior over hidden mutation
- avoid dense one-liners that compress too much transformation logic into unreadable expressions
- choose the clearest collection operation, not the cleverest one
- prefer direct, intention-revealing collection operations such as "find", "some", "includes", and explicit loops over indirect workarounds
- avoid using reduction-style constructs for complex control flow when a simple loop is easier to read and debug

#### Import and dependency hygiene

- keep import order and dependency direction consistent
- keep type-only or metadata-only imports visibly distinct where the language supports that concept
- avoid circular dependencies
- avoid duplicate imports
- avoid self-imports
- expose module boundaries through intentional public APIs
- do not deep-import internals from another module when a supported public entrypoint exists

#### Security equivalents

- do not use dynamic code execution
- do not pass untrusted input into shells, file paths, regex builders, evaluators, serializers, or interpreters without explicit controls
- do not use insecure randomness for security-sensitive behavior
- use timing-safe comparisons for secrets where relevant
- do not log protected fields

### Naming And File Organization Rules

1. Use descriptive names that explain intent, not only implementation.
2. Prefer full words over unclear abbreviations, except for widely understood local conventions.
3. Boolean values should read like predicates: `is`, `has`, `can`, `should`.
4. Functions should usually read like actions: verb plus noun.
5. Predicate helpers should read like questions.
6. Transformers and mappers should read like conversions.
7. Keep filenames ownership-based and descriptive.
8. Avoid catch-all filenames such as `utils`, `helpers`, `types`, or `misc` at important module boundaries when more specific names would improve discoverability.
9. Avoid vague abbreviations when a full word keeps intent clearer.

### Common Module Documentation Rules

Every shared or common module must be documented well enough that engineers and AI agents know to reuse it instead of bypassing it.

For each reusable shared module, component set, adapter, or common library wrapper, document:

1. module purpose
2. ownership
3. public API surface
4. acceptable use cases
5. prohibited use cases
6. dependencies on third-party libraries or runtime services
7. extension pattern
8. migration or replacement notes if the dependency ever changes

If a common module exists but nobody can tell when or how to use it, the documentation is insufficient.

### Architecture-Independent Layering Rules

Map these rules to your local architecture:

- Transport or delivery layers should extract input, call the next layer, and return the result. They should stay thin.
- Application or orchestration layers should coordinate use cases, permissions, transactions, and side effects.
- Domain layers should own business rules, invariants, calculations, and decisions.
- Persistence layers should own data reads and writes.
- Integration layers should own external service calls, SDK calls, broker interactions, and protocol handling.
- Presentation layers should render states and route interactions, not contain hidden business policy.

If the codebase does not use all these layers explicitly, the responsibilities still need to exist conceptually.

### Complexity And Extraction Rules

Use these as default thresholds unless the local codebase has stricter ones:

- transport methods should usually stay under 10 lines of real logic
- standard business methods should usually stay under 40 lines of real logic
- orchestration methods should usually stay under 80 lines of real logic
- complex methods above these limits require decomposition or explicit justification
- ordinary function complexity should target 10 or below
- orchestration function complexity should target 15 or below

When logic starts to sprawl:

- extract validation
- extract transformation
- extract policy decisions
- extract integration calls
- extract reusable types, constants, schemas, or helpers

Do not perform extraction mindlessly. Extract to improve clarity and ownership, not to manufacture tiny files with no meaning.

### Module Boundary Rules

- keep domain ownership explicit
- keep public interfaces small and intentional
- avoid backdoor imports into internals of another module or service
- version shared contracts carefully
- treat breaking changes as first-class events, not incidental side effects
- prefer adapters over deep imports from volatile third-party packages

### Configuration And Environment Rules

- configuration must be explicit, validated, and documented
- new config values must update templates, runtime settings, deployment definitions, and docs where relevant
- secrets must never be committed
- environment-specific behavior must be clear and testable
- config drift between local, test, staging, and production must be understood before release
- feature flags must have owners, purpose, rollout criteria, and retirement expectations

### Contract And Validation Rules

- validate input at trust boundaries
- bound strings, arrays, file sizes, and payload sizes with reasonable limits
- define machine-readable errors for system-to-system boundaries
- use stable contract definitions and examples
- identify backward compatibility expectations explicitly
- do not rely on clients to enforce server-side constraints
- define what is required, optional, deprecated, and forbidden

### Error Handling Rules

- every important failure path must be explicit
- retries must have limits, backoff, and observability
- timeouts must be defined for remote dependencies
- partial failure behavior must be deliberate
- user-visible workflows must surface meaningful error states
- operator-visible workflows must surface actionable diagnostics
- error messages must be safe to expose at the correct boundary

### Async, Event, Job, And Long-Running Workflow Rules

- background jobs must be idempotent where practical
- event-driven workflows must have traceability from trigger to effect
- queues and retries must have failure handling, dead-letter or equivalent strategy, and visibility
- long-running client workflows must not wait forever; they need terminal success, failure, timeout, and cancellation behavior
- if streaming or polling exists, define stop conditions and fallback behavior
- if asynchronous failure affects the user outcome, the user must eventually receive a terminal failure state, not endless loading

### UI And UX Rules

- every interactive element must do meaningful work or be visibly disabled with reason
- every user-facing workflow must define loading, empty, success, error, partial-failure, and permission-denied states where relevant
- accessibility is mandatory
- keyboard and focus behavior must be considered for interactive flows
- user-facing copy must be clear and operationally correct
- do not ship decorative feature stubs masquerading as working features
- if the system supports localization, user-facing text must be localized consistently

### Data, Migration, And State Rules

- schema changes require a forward plan and rollback plan
- destructive changes require special care, validation, and approval
- data migrations and backfills need observability, retry behavior, and completion validation
- persistence-changing tests should verify resulting state, not only request success
- do not assume cache state and persisted state are the same; verify both when relevant
- define retention, masking, and deletion expectations for sensitive data

### Observability Rules

- logs must be structured enough to diagnose issues
- metrics must exist for business-critical and operationally critical workflows
- traces or correlation identifiers must connect multi-step workflows where possible
- alerts must exist for material failure modes before release of critical changes
- logs must be checked after significant tests and after deployment
- dashboards must answer whether the change is healthy, degraded, or failing

### Documentation Rules

- documentation is part of the implementation
- update docs whenever reality changes
- examples, diagrams, commands, and workflows must stay current
- operator and support docs matter as much as developer docs for operationally significant changes
- release notes are required for user-visible or operator-visible behavior changes

### Repository Standards And Control Files Rules

- every mature repository must have explicit standards documents, not only implied habits
- standards files must define engineering, testing, release, security, and documentation expectations clearly enough for a new engineer or AI agent to follow them without guessing
- when a new enduring pattern appears, update the governing document instead of letting the rule live only in one pull request or one person's memory
- if the codebase uses generators, codegen, scaffolds, or templates, they must be documented and included in the change review when behavior or contracts depend on them
- if the codebase relies on build scripts, test scripts, release scripts, migration scripts, or developer bootstrap scripts, those scripts are part of the product and must be reviewed and updated when affected
- repository control files such as ignore rules, code owner maps, CI config, formatter config, linter config, test config, security scan config, release config, and dependency policies must be treated as first-class delivery artifacts

### Module Documentation Rules

- every meaningful module, service, package, library, domain area, or subsystem should have discoverable documentation that explains what it owns, what problems it solves, what contracts it exposes, and what it depends on
- module documentation must identify boundaries, responsibilities, public interfaces, key workflows, failure modes, and operational notes where relevant
- if a new module is introduced without documentation, the change is incomplete
- if an existing module changes its responsibilities, contracts, or usage expectations, the module documentation must be updated in the same delivery stream
- the deeper or more reusable a module is, the higher the documentation expectation

### Shared Standards For Types, Contracts, Constants, And Errors

- shared domain concepts must be defined once and reused consistently
- shared constants, contract definitions, enumerations, schemas, error catalogs, and policy identifiers should live in discoverable dedicated locations rather than being re-invented ad hoc across the codebase
- when a concept crosses module or service boundaries, document its canonical source of truth
- avoid scattering duplicate contract definitions across multiple layers when code generation, shared packages, or documented schemas can keep them aligned
- if a repository cannot use generated or shared contracts, the synchronization approach must still be documented

### Script, Command, And Automation Rules

- every recurring quality task should have a stable command or script rather than depending on memory
- build, test, lint, type-check, package, migration, seed, rollback, smoke-test, and release commands should be documented and discoverable
- when a new change introduces a recurring operational step, consider whether a script or automation should own it instead of a manual checklist line alone
- scripts must be safe, deterministic where practical, and documented with inputs, outputs, and side effects
- destructive or high-risk scripts must require clear intent and should log what they changed
- CI must use the authoritative commands or script entrypoints rather than a divergent shadow set of steps

### Quality Script And Validation Harness Rules

- if a codebase has a dedicated QA, smoke-test, migration-check, data-verification, or release-readiness script system, it must be maintained as part of the product
- if a feature requires repeatable validation, provide a durable test harness, script, fixture, or documented execution path rather than a one-off undocumented command sequence
- if runtime health checks, readiness checks, or canary checks exist, they must be updated when the change affects them
- if a validation step is important enough to block release, it should be automatable where practical

### Pre-Commit, Pre-Push, And Local Gate Rules

- every repository must define which checks run at pre-commit, commit-message, pre-push, or equivalent local gates
- at minimum, local gates for changed code should run formatting, linting or static analysis, type or compile validation where the stack supports it, and tests proportional to the changed scope
- if some checks are too expensive for pre-commit, the split between pre-commit, pre-push, and CI must be explicit and documented
- hook installation must be part of normal repository bootstrap or be documented clearly if an explicit opt-in step is required
- commit-message validation must be automated when the repository enforces message format
- generated files, lockfiles, manifests, schemas, or derived artifacts that belong in version control must be verified as current before commit
- local gates must use the same authoritative commands or script entrypoints as CI wherever practical
- a local gate failure must be fixed at the root cause, not hidden by disable comments, skipped assertions, weakened thresholds, or silent retries
- never bypass pre-commit or pre-push gates using `--no-verify` or equivalent unless an emergency exception is approved in writing
- any emergency bypass must record:
  - why the bypass was necessary
  - who approved it
  - what checks were skipped
  - when the skipped checks will be restored and re-run

### Commit, Branch, And Change Packaging Rules

- every branch should map to one request ID, one approved workstream, or one intentionally grouped slice of a larger roadmap
- do not mix unrelated cleanup, opportunistic refactors, dependency churn, or formatting noise into a feature or bug-fix branch without stating it explicitly
- commits must be logically grouped, reviewable, and traceable to meaningful steps in the change
- behavior-changing code must ship with its related tests and documentation updates in the same branch or pull request
- commit messages must follow the repository convention; conventional commits are the default recommendation unless the company defines a stricter standard
- commit subjects should describe the intent or behavior change, not vague labels such as `update`, `changes`, `misc`, or `fix stuff`
- WIP, spike, debug, temporary, or placeholder commits must not be merged into protected branches
- branch names should include the request identifier and a short readable slug when the repository policy supports that pattern
- force-pushing a shared branch requires awareness of collaborators and must not erase reviewable context unexpectedly
- do not commit secrets, local environment files, machine-specific artifacts, private exports, raw production data, or disposable debug output
- do not split a critical bug fix from its regression test unless a documented emergency sequence requires it
- if a repository uses squash, rebase, merge commit, or stacked-change strategy, that strategy must be documented and followed consistently

### Pull Request Packaging Rules

- every pull request must identify the request ID or governing artifact set
- every pull request must summarize:
  - problem being solved
  - scope included
  - scope intentionally excluded
  - risk level
  - affected domains
  - test evidence
  - documentation updates
  - rollout and rollback notes
  - flags, migrations, or operational dependencies
- UI changes should include screenshots, recordings, or other visible evidence when practical
- API or contract changes should include example requests, responses, or contract diffs when practical
- pull requests must list known gaps, deferred items, waivers, and explicit follow-up work instead of leaving them implicit
- unresolved blocker comments prevent merge
- materially changing the implementation after approval may require re-review according to repository policy

### CI/CD, Build, And Release Pipeline Rules

- CI must reproduce the authoritative local commands or scripts in a clean environment
- required checks must be version-controlled, visible, and enforced; required jobs must not be marked as optional or allow-failure
- CI must validate at the appropriate layers for the change, including where applicable:
  - formatting checks
  - linting
  - static analysis
  - type or compile validation
  - unit tests
  - integration tests
  - contract tests
  - UI tests
  - E2E tests
  - coverage checks
  - packaging or build validation
  - dependency or license policy checks
  - security scans
  - migration validation
  - smoke tests for deployable artifacts
- CI caches must speed up builds without hiding broken dependencies, stale generated code, or missing bootstrap steps
- the artifact validated in CI should be the artifact promoted through environments when provenance, integrity, or reproducibility matters
- build outputs must be traceable to the exact source revision, configuration set, and pipeline run that produced them
- deployment pipelines must record who approved the release, what artifact was deployed, which configuration version was used, which migrations ran, and what the final result was
- if the organization uses staged promotion across environments, promotion rules and approval boundaries must be documented
- flaky pipelines are defects; do not normalize unstable gates by rerunning until green without root-cause work
- emergency releases still require explicit evidence of what was and was not validated

### Environment, Configuration, And Secret Handling Rules

- every configuration input must have documented:
  - name
  - purpose
  - owner
  - type or format
  - allowed values or constraints
  - default behavior
  - sensitivity classification
  - environment scope
- runtime configuration must be validated at startup, deploy time, or pipeline time so invalid configuration fails fast
- configuration templates, bootstrap scripts, deployment definitions, and documentation must be updated together when configuration changes
- do not scatter raw environment access throughout the codebase when a validated configuration layer can centralize behavior
- secrets must come from approved secret-management mechanisms and must never be hardcoded, committed, or exposed in logs, screenshots, support artifacts, or analytics
- secret rotation, expiry, revocation, and local development substitution rules must be documented for important credentials
- environment-specific differences must be intentional, discoverable, and reviewable; hidden drift is a release risk
- feature flags and operational toggles must have owners, default state, rollout criteria, rollback criteria, and retirement expectations
- if a shared library, runtime dependency, generated artifact, or build input changes, perform a clean rebuild or redeploy of affected units rather than trusting stale caches or partial hot reload alone
- if a change adds a new service, queue, topic, database, storage bucket, scheduled job, or external integration, all required configuration and bootstrap paths must be updated in the same delivery stream

### Infrastructure, Runtime, And DevOps Rules

- infrastructure-as-code, deployment manifests, pipeline definitions, runtime policies, network rules, and operational scripts are production code and must be reviewed with the same seriousness as application code
- every deployable unit must define:
  - owner
  - runtime dependencies
  - startup behavior
  - shutdown behavior
  - health or readiness expectations
  - resource expectations
  - failure signals
- every new service, worker, queue consumer, scheduled process, integration endpoint, or background job must ship with logging, metrics, correlation or tracing strategy, dashboards, alerts, and runbook coverage before release
- every externally reachable endpoint or route change must update ingress, gateway, proxy, service-discovery, DNS, certificate, auth, and rate-limit expectations where relevant
- every stateful dependency must define backup, retention, recovery, and migration expectations
- retry rules, timeout rules, concurrency limits, idempotency expectations, dead-letter handling, and backpressure behavior must be explicit for asynchronous and distributed workflows
- platform changes must be validated in environments that exercise real deployment behavior, not only local mocks
- if deployment requires manual steps, document:
  - step order
  - owner
  - expected outputs
  - abort criteria
  - rollback action
- if runtime health, readiness, startup order, or dependency wiring changes, smoke tests and health checks must change with it
- if a release depends on feature flags, config toggles, or tenant-scoped enablement, default state, rollout order, and rollback order must be explicit
- operational knowledge must not live only in one engineer's memory; capture it in runbooks, release docs, and support guides

### Migration, Seed, Backfill, And Data Operation Rules

- every schema, storage, or contract evolution must define forward compatibility, backward compatibility, rollout sequencing, and rollback or roll-forward strategy
- never edit already-applied production migrations in place; create additive corrective changes instead
- migrations must be tested on empty state, representative current state, and failure or partial-progress scenarios when the risk justifies it
- destructive data operations require explicit approval, recovery thinking, and observability during execution
- seeds, fixtures, and bootstrap data must be idempotent where practical or clearly protected if they are intentionally one-time only
- backfills must be chunked, resumable where practical, observable, rate-aware, and safe to pause or retry
- data scripts must report what they changed, how many records were touched, what failed, and whether rerun is safe
- state-changing validation must verify actual persisted results, not only request acceptance or job enqueue success
- if privacy, retention, legal hold, or audit requirements apply, data changes must honor them explicitly
- if a change alters shared or customer-facing data semantics, support, analytics, reporting, and migration docs must be updated in the same delivery stream

## Mandatory Impacted-Area Checklist

For every request, explicitly review whether the change affects any of the following:

- business process
- user workflow
- client workflow
- frontend or presentation layer
- backend or application layer
- mobile or desktop client
- shared libraries or packages
- APIs or public contracts
- internal contracts
- schemas or data models
- migrations or backfills
- queues, events, jobs, or schedulers
- caching, search, indexing, or reporting
- analytics, tracking, or BI outputs
- authentication, authorization, or tenant isolation
- secrets, config, or environment variables
- deployment manifests or infrastructure-as-code
- ingress, proxy, API gateway, or routing rules
- CI/CD
- test fixtures or seed data
- health checks
- dashboards, alerts, or traceability
- support workflows
- runbooks
- user docs
- release notes
- legal or compliance obligations
- `claude.md`

If an area is affected, the related work must be documented, implemented, tested, and reflected in the relevant artifacts.

## Mandatory Change Checklist

For every change, explicitly review and update the following if affected:

1. configuration templates and example environment files
2. actual development, staging, or test configuration values needed to run the change
3. local bootstrap or install scripts
4. deployment manifests, container definitions, orchestration files, or infrastructure code
5. ingress, proxy, API gateway, service discovery, or route configuration
6. CI workflows and required checks
7. health checks and service catalog entries
8. shared contracts, SDKs, generated clients, or consumer-facing types
9. schema definitions, migrations, rollback scripts, and backfills
10. seed data, fixtures, factories, and test data helpers
11. permission matrices, role definitions, or policy maps
12. analytics event schemas, dashboards, and reports
13. localization files or content systems if user-facing text changes
14. architecture docs and ADRs
15. API docs and reference docs
16. runbooks and operational procedures
17. support enablement and known-issues guidance
18. release notes
19. onboarding docs
20. `claude.md`

A change is incomplete if an affected item was not reviewed.

## Quality Engineering Operating Model

### Core Mindset Rules

1. Never trust a passing happy path alone.
2. Never trust isolated unit tests as the whole story.
3. Never trust UI state without checking persisted or returned truth where relevant.
4. Never trust backend success without checking client, operator, or downstream impact.
5. Never trust a local test only when the change is integration-heavy.
6. Never trust technical correctness without business correctness.
7. Never trust business correctness without release and operational readiness.
8. A feature is not implemented when code compiles; it is implemented when it is reviewed, tested, documented, supportable, and releasable.
9. A bug is not fixed when the symptom disappears; it is fixed when the root cause is understood, covered, and regression-checked.

### Required Test Layers

For every request, assess which of these layers are needed and document why:

- unit tests
- module tests
- service or use-case tests
- repository or persistence tests
- API or contract tests
- integration tests
- UI component tests
- UX flow tests
- end-to-end tests
- regression tests
- security tests
- permission or RBAC tests
- analytics or event-tracking validation
- migration tests
- rollback tests
- performance checks
- exploratory manual testing
- UAT
- client acceptance testing

### Test Environment Rules

- define where each test layer runs
- use representative environments for integration-heavy work
- keep test data intentional and documented
- seed or fixture data must be understandable and reproducible
- lower environments must expose enough telemetry to debug failures
- production-like configuration differences must be known before release
- if production parity cannot be achieved, the gap and risk must be documented explicitly

### Test Design And Execution Rules

- map every acceptance criterion, important risk, and important failure mode to at least one validation method
- every bug fix must include a regression test or documented reproducible validation that proves the original failure is covered
- design tests for:
  - happy paths
  - validation failures
  - boundary conditions
  - permission and access-control behavior
  - tenant or ownership isolation
  - partial failures
  - retry and timeout behavior
  - concurrency or duplicate-delivery conditions
  - external dependency failures
  - migration and rollback scenarios
  - localization and content correctness where relevant
  - accessibility behavior where relevant
  - observability side effects where relevant
- when a common module, shared wrapper, or reusable component changes, test more than one consumer or verify compatibility at the shared boundary
- keep automated tests deterministic:
  - control time where possible
  - control randomness where possible
  - avoid arbitrary sleeps when a stable synchronization mechanism exists
  - isolate external side effects or use intentional sandbox systems
- do not over-mock the exact logic you are trying to prove; mock at the right boundary
- test names should describe the scenario and expected outcome clearly enough that failures explain themselves
- if a scenario cannot be automated yet, document the exact manual procedure and the residual risk

### Test Data, Fixtures, And Isolation Rules

- fixtures must be minimal enough to understand and realistic enough to reveal real behavior
- separate baseline seed data, edge-case data, and negative-case data intentionally
- test data for permission, tenant, role, ownership, or workflow logic must cover the combinations that matter to safety and business correctness
- tests must be isolated, repeatable, and safe to rerun without depending on hidden external state
- cleanup rules must be explicit for tests that create durable state
- anonymize or synthesize any production-like data used outside approved secure environments
- if an incident or escaped defect inspired a new test case, preserve the representative scenario in fixtures or documented steps
- seed and fixture changes must be reviewed with the same care as schema changes when they affect product behavior or test truth

### QA Evidence And Validation Harness Rules

- meaningful workflows must have repeatable validation through a script, harness, checklist, or clearly documented execution path
- QA and developer validation harnesses should define:
  - prerequisites
  - setup or authentication
  - execution steps
  - expected results
  - persistence verification
  - log or telemetry verification
  - cleanup steps
- evidence must record:
  - environment
  - build or commit identifier
  - execution date and time
  - operator
  - input data used
  - actual result
  - defects found
- if a step was not run, record it explicitly with reason, risk, and owner
- when defects are found, keep the original failing evidence and the retest evidence; do not overwrite history
- evidence storage location must be discoverable from the request artifacts

### Performance, Reliability, And Operational Validation Rules

- performance-sensitive changes require latency, throughput, memory, or resource validation appropriate to the risk
- reliability-sensitive changes require timeout, retry, failure-injection, or degraded-dependency validation appropriate to the risk
- distributed or asynchronous changes require idempotency and duplicate-processing validation where relevant
- operationally important changes require post-deploy smoke tests and live-signal checks before release is considered complete
- if the organization uses SLIs, SLOs, or error budgets, validate and document the expected impact before release and the observed impact during hypercare

### Required Validation Before Claiming Done

Before saying work is complete, all applicable checks must be green:

- formatting or style checks
- linting
- static analysis
- type checks or equivalent compile-time validation
- unit tests
- integration tests
- E2E tests where applicable
- build or packaging validation
- environment or deployment validation for affected runtime pieces
- manual exploratory validation
- security validation for relevant risk areas
- documentation updates

### Real QA Execution Rules

Independent validation must include real execution, not only reading code.

Where applicable, QA and developer validation must include:

- real API or contract execution
- real UI or client interaction
- real workflow progression through the affected path
- verification of persistence after writes or state transitions
- verification of emitted events, messages, jobs, or notifications
- log inspection for critical errors after test runs
- regression checks for adjacent workflows

### Required Evidence Types

For meaningful changes, keep evidence appropriate to the risk:

- command output summaries
- screenshots
- request and response samples
- database or state verification notes
- logs or traces
- dashboard checks
- issue and defect records

### Coverage Rules

- minimum touched-module coverage target: `95%` lines, functions, statements, and real branches; the executable aggregate branch floor may remain `90%` only for documented decorator-transform synthetic branches, never for untested behavior
- critical logic should be near-complete and scenario-rich
- do not use high global averages to excuse weak coverage in changed code
- a high percentage with shallow scenarios is still inadequate

### Testing Blockers

The following block delivery unless explicitly waived by authorized leadership:

- failing lint or static-analysis checks
- failing type checks or build validation
- failing automated tests
- missing tests for changed behavior
- missing validation for critical failure paths
- missing regression coverage for high-risk changes
- missing evidence for security-sensitive workflows
- missing documentation of known limitations

## Mandatory Post-Implementation Gate

After implementation and before declaring completion, confirm all applicable items:

- [ ] code changes are reviewable and scoped
- [ ] affected artifacts updated
- [ ] lint and static checks passed
- [ ] type checks or compile checks passed
- [ ] automated tests passed
- [ ] manual validation completed
- [ ] persistence or state verification completed for writes and transitions
- [ ] logs inspected for critical failures after validation
- [ ] coverage threshold met or waiver recorded
- [ ] docs updated
- [ ] release notes updated when behavior changed
- [ ] rollback path remains valid
- [ ] known gaps recorded explicitly

## Review And Merge Rules

### Code Review Rules

- every change must be reviewed by someone qualified to understand its impact
- changes touching shared contracts, security, auth, permissions, compliance, or money flow require deeper review and may require multiple reviewers
- reviewers must examine behavior, architecture fit, test quality, docs, and operational impact, not only style
- reviewers must use blocker language clearly: `MUST FIX`, `SHOULD FIX`, `FOLLOW-UP`

### Pull Request Review Rules

- reviewers must be able to trace the change back to its request ID, artifacts, and stated acceptance criteria
- reviewers must verify that tests actually cover the changed behavior rather than merely increasing totals
- reviewers must verify that shared modules, wrappers, contracts, and documentation were updated when the change touches them
- reviewers must check whether migrations, config, CI, health checks, runbooks, dashboards, or release notes were affected and either updated or explicitly marked not applicable
- approvals are not valid substitutes for missing evidence
- unresolved blocker comments, missing context, or stale approvals on materially changed code prevent merge

### Merge Rules

Do not merge when any of the following is true:

- scope differs materially from approved plan without documentation
- architecture impact is undocumented
- tests are missing or failing
- coverage gate is red without waiver
- docs are stale for changed behavior
- required approvals are missing
- rollback is undefined
- observability is undefined for material release risk
- required local gates, commit-message rules, or CI gates were bypassed without an approved recorded exception

## Approval Workflow

- intake owner confirms classification and request ID
- business owner approves business framing
- product owner approves requirements
- technical owner approves technical direction
- architecture approver approves architecture changes when applicable
- QA lead approves QA sign-off
- security approver approves security review when applicable
- operations or SRE owner approves rollout and observability readiness when applicable
- business owner approves UAT
- client or external stakeholder approves when contractually required
- release owner records GO or NO-GO

If local roles differ, map local roles to these responsibilities explicitly.

## Defect Workflow

1. log the defect with request ID, severity, environment, reproducer, and owner
2. determine whether it is blocking, high-risk, accepted, or deferred
3. reproduce and identify root cause
4. implement the fix in a reviewable change
5. add or update tests for the exact failure mode
6. re-run relevant validation and regression
7. return to QA, business, or client validation as needed
8. update docs, release notes, support context, and postmortem actions if the issue escaped late

No defect is done without retest.

## Security Baseline Rules

- apply least privilege
- enforce authorization on trusted server-side or authoritative boundaries
- treat tenant isolation as testable behavior, not a belief
- classify data and protect sensitive data in transit, at rest, and in logs
- review abuse paths, misuse cases, and privilege escalation routes
- review dependency and supply-chain risk
- review CI/CD access and artifact integrity for important releases
- ensure auditability for important security or administrative actions

## Release, Rollout, And Rollback Rules

- prefer staged rollout, canary, feature flags, tenant-scoped enablement, or dark launch where risk justifies it
- define rollout owner, release window, communications, and success metrics
- define rollback triggers before release
- validate smoke tests immediately after deploy
- keep rollback feasible until stability is confirmed
- do not release when monitoring, alerting, or on-call ownership is unclear

## Hypercare And Postmortem Rules

- hypercare is a planned operating window with owners, duration, and success criteria
- incidents or serious defects must trigger explicit triage and communication
- serious incidents require blameless postmortems
- retrospectives are mandatory even when nothing catastrophic happened
- learnings that create permanent policy changes must update `claude.md`

## Hotfix Rules

Hotfixes are faster, not looser.

For hotfixes:

- all phases still exist
- analysis may be compressed, but not skipped
- approvals may be accelerated, but not erased
- documentation may be updated in near-real-time, but not abandoned
- rollback readiness is even more important than usual
- follow-up retrospective is mandatory

## Non-Negotiable Gates

- No implementation before phases `00` through `13` are complete.
- No pull request without tests.
- No pull request without documentation updates where behavior changes.
- No merge when touched-module coverage is below threshold unless a documented waiver is approved.
- No merge if lint, static analysis, type checks, builds, tests, or security checks fail.
- No bypass of required commit hooks, pre-push hooks, or CI gates without an approved and documented exception.
- No merge if architecture impact is undocumented.
- No release without QA sign-off.
- No release without security validation when applicable.
- No release without a rollback plan.
- No release without observability, alerting, and smoke tests.
- No release without documentation updates.
- No release without GO / NO-GO approval.
- No release without required business, compliance, or client approval.

## Definition Of Done

Work is done only when all of the following are true:

- the problem is understood
- the scope is explicit
- the implementation matches approved intent
- architecture fit is documented
- tests are adequate to the risk
- quality gates are green
- security review is complete when needed
- QA sign-off exists
- UAT and client approval exist where required
- docs are updated
- release and rollback plans are ready
- support and operations are prepared
- hypercare ownership is known

If any of these are false, the work is not done.

## When This File Must Be Updated

Update `claude.md` whenever a new permanent rule or expectation appears in any of these areas:

- SDLC phases or gates
- request classification rules
- approval rules
- architecture rules
- module boundaries
- coding standards
- config and environment handling
- test strategy
- coverage thresholds
- QA workflow
- security baseline
- release process
- commit and branch policy
- pre-commit and local quality gates
- CI/CD pipeline policy
- environment and secret handling
- infrastructure and DevOps rules
- rollout or rollback policy
- observability policy
- incident handling
- documentation requirements
- support readiness
- hotfix policy

## Final Instruction

Treat this file as company policy, not advice. Do not skip detail because a request looks small. Do the work in order, write the artifacts, respect the gates, and optimize for software that is correct, secure, testable, observable, maintainable, documented, supportable, and reversible.
