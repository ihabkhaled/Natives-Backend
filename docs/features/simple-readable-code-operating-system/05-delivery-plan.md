# 05 — Delivery Plan: Simple Readable Code Operating System

## Workstreams and sequence

| #   | Workstream                                                                              | Depends on | Owner                      |
| --- | --------------------------------------------------------------------------------------- | ---------- | -------------------------- |
| 1   | Repository investigation (rules/skills/context/memory/entrypoints/eslint/docs formats)  | —          | AI-assisted delivery agent |
| 2   | Canonical rules: `rules/20`–`24` + extensions to `rules/00`, `13`, `15`, `README`       | 1          | Same                       |
| 3   | ESLint: simplicity caps, revived dead overrides, config-activation spec                 | 1          | Same                       |
| 4   | Skills: 1 exemplar + 9 playbooks + `skills/README` catalog                              | 2          | Same                       |
| 5   | Context (`simple-code-map.md`, indexes) and memory (decisions file, pitfalls J, routes) | 2          | Same                       |
| 6   | Agent entrypoints: `claude.md` + mirrors + `AGENTS.md` + 5 family files + Cursor files  | 2          | Same                       |
| 7   | docs/sdlc baseline + review-checklist + engineering-standards + root README             | 2          | Same                       |
| 8   | Environment root-cause fixes (npm install, `.gitattributes`, LF renormalization)        | —          | Same                       |
| 9   | Gates + adversarial verification + validation/changelog artifacts                       | 2–8        | Same                       |

## Blockers found and cleared

- Stale `node_modules` (bcrypt absent) — cleared with `npm install`.
- CRLF working tree failing prettier-as-lint — cleared with `.gitattributes` (`* text=auto eol=lf`), `core.autocrlf false`, renormalization.
- Pre-existing `auth.service.ts` inline-helper violation revealed by the revived rule — cleared by extraction to `lib/password.helpers.ts`.

## Approvals

Repository architect owns all approvals (single-owner workspace); gates + review artifacts stand in for QA sign-off per the audit-feature precedent.

## Rollout strategy

Single delivery stream on `main` working tree; no runtime rollout. Docs and lint config take effect on merge. Rollback = revert the commit(s); no data, schema, or deployment surface involved.

## Risk list

| Risk                                                          | Mitigation                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Revived/added lint rules flag existing code                   | Full gate run; the only violation found was fixed at root cause              |
| Tightened `cognitive-complexity` (20 → 15) breaks future work | Codebase already passes at 15; threshold is stricter-only, allowed by policy |
| Mirror/entrypoint drift                                       | Compact pointers only; canonical bodies in `rules/`; verification sweep      |
| Simplicity misread as safety-cut license                      | Rule 46 + 15 §2a MUST FIX blocker + pitfalls J4                              |
