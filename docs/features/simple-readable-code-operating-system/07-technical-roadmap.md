# 07 — Technical Roadmap: Simple Readable Code Operating System

## Engineering milestones (executed order)

1. Investigation sweep over all governance surfaces (formats, numbering, insertion points, ESLint inventory).
2. Environment root-cause fixes: `npm install` (stale bcrypt), `.gitattributes` + `core.autocrlf false` + LF renormalization.
3. Canonical rules `20`–`24`; `rules/00` gains rules 43–46 + pre-flight line; `rules/README` indexed.
4. ESLint changes + `test/eslint/config-rule-activation.spec.mjs`; `src/modules/auth` violation fixed (`lib/password.helpers.ts`).
5. `rules/13` and `rules/15` aligned to the new config and canon.
6. Skills (1 + 9) + `skills/README`.
7. Context + memory + entrypoints + docs/sdlc + README.
8. Full gate run; dev-validation and documentation-changelog artifacts; adversarial verification sweep.

## Branch and merge strategy

Single stream in the `main` working tree (matches the audit-feature precedent for repository-state changes). One logical delivery; conventional-commit message(s) on commit. No feature flags.

## Schema evolution / rollout / rollback

- Schema: Not applicable — no database or contract surface. Accepted by: repository architect.
- Rollout: effective on merge; nothing to deploy.
- Rollback: `git revert` of the delivery commit(s) restores prior policy and config; `.gitattributes` revert would reintroduce the CRLF checkout risk and is called out as a known cost of rollback.

## Compatibility notes

- All ESLint changes are stricter-only or bug-fix activations; no rule was loosened, no threshold raised.
- `sonarjs/cognitive-complexity` 20 → 15 and the revived overrides were validated against the entire existing codebase (one violation, fixed at root cause).
- Mirror files (`codex.md`, `cursor.md`) received the identical single-hunk addition as `claude.md`, preserving their existing 2-line structural offset.
