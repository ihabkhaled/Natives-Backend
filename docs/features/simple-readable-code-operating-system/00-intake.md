# 00 — Intake: Simple Readable Code Operating System

## Request metadata

| Field               | Value                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Request ID          | `GOV-2026-07-09`                                                                                  |
| Title               | Add and wire a Simple Readable Code Operating System into IronNest governance                     |
| Type                | Governance / engineering-operating-system / documentation / skills / review-checklist enhancement |
| Source              | Repository owner                                                                                  |
| Severity            | Medium                                                                                            |
| Urgency             | Medium                                                                                            |
| Affected domains    | Engineering rules, skills, agent entrypoints, memory, context, docs/sdlc, ESLint governance       |
| Delivery track      | Standard                                                                                          |
| Critical-risk flags | None. One behavior-neutral relocation inside `src/modules/auth` — see the critical-risk review    |

## Classification

- governance enhancement
- engineering operating system enhancement
- AI-agent behavior enhancement
- coding style rule enhancement
- maintainability / developer-experience enhancement
- documentation update
- skills/playbooks update
- review checklist update
- ESLint/static enforcement investigation (analysis; changes only if safe and tested)

## Initial scope statement

Add a permanent **Simple Readable Code Operating System** to IronNest so that generated and hand-written backend code is junior-readable, senior-trustworthy, boring in the best way, reuse-first, and minimal — **without weakening** any existing security, validation, architecture, testing, observability, i18n, or reliability rule:

1. New engineering rules (`rules/20`–`rules/24`): simple readable code, YAGNI/minimalism, reuse-before-creating, size discipline, team-readable review.
2. New skills (10 playbooks) applying those rules; extend, not duplicate, existing skills such as `decompose-large-file.md`.
3. Compact pointers in every agent entrypoint (`claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`, `.cursorrules`, `.cursor/rules/*.mdc`) — no duplicated rule bodies.
4. Durable memory decisions, context navigation for simplicity concerns, and a `docs/sdlc` baseline document.
5. Investigation of what ESLint already enforces for simplicity; gaps closed only with tested, low-false-positive changes or documented as future improvements.

## Owners

| Role            | Owner                                                |
| --------------- | ---------------------------------------------------- |
| Technical owner | Repository architect                                 |
| Implementation  | AI-assisted delivery agent                           |
| QA              | Automated test suite + lint/typecheck/coverage gates |
| Docs            | Same delivery agent                                  |

## In-scope

- New numbered rule files and index updates.
- New skill playbooks and index updates.
- Agent entrypoint compact pointers.
- Memory, context, and docs/sdlc updates.
- ESLint simplicity-enforcement investigation report.
- SDLC artifacts for this request.

## Out-of-scope (non-goals)

- Rewriting or weakening any existing rule, gate, or hook.
- New business features or modules.
- Refactoring `src/` application code beyond the root-cause fixes needed to keep the gates green under the tightened lint (see the critical-risk review).
- "Fewest lines at any cost" golf rules — the goal is minimum **safe** code, not shortcut code.
- Heavy new lint rules with false-positive risk.

## Critical-risk review

Money flow, permissions, privacy, tenant isolation, compliance, external integrations, reporting, and critical workflows are **not touched**. The change is documentation/governance plus small, tested lint-config tightening.

**Amended during phase 14** (recorded here as the phase progressed, not backfilled from memory): reviving the previously-dead `architecture/no-inline-layer-declarations` override surfaced one real violation in `src/modules/auth/application/auth.service.ts` — a module-level `verifyPassword` helper. It was relocated unchanged to `src/modules/auth/lib/password.helpers.ts`. **No authentication behavior changed:** same bcrypt `compare`, same call site, same `Promise<boolean>` contract; the existing `auth.service.spec.ts` exercises it against real bcrypt hashes and passes unmodified. Authentication stays a critical-risk area for review purposes; the delivered edit is a pure relocation demanded by an existing non-negotiable rule (rules 10–16).
