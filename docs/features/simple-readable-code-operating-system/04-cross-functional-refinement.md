# 04 — Cross-Functional Refinement: Simple Readable Code Operating System

## Participants

| Function     | Input                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Engineering  | Rule numbering (20–24 free), extraction thresholds already in rules/03, no-duplicate rule already in rules/06 §6               |
| QA           | Automated gates + a new config-activation spec guard the ESLint changes; readable-test expectations added to rules 23/24       |
| Security     | Reviewed that simplicity rules cannot weaken any existing rule; rule 46 makes "safety cut for simplicity" an explicit MUST FIX |
| DevOps / SRE | Not applicable — no runtime, deployment, or infra change. Accepted by: repository architect                                    |
| Support      | Not applicable — internal governance change with no operator-facing behavior. Accepted by: repository architect                |
| Analytics    | Not applicable — no analytics surface exists in this workspace. Accepted by: repository architect                              |
| AI-agent ops | Every entrypoint (Claude/Codex/Cursor/Kimi/Gemini/GLM/Qwen/DeepSeek) needs the compact ladder pointer, no restated bodies      |

## Findings and hidden work surfaced

1. **ESLint dead-override defect (pre-existing):** three `architecture.config.mjs` overrides used regex strings in flat-config `files:` entries, which never match — `no-inline-layer-declarations`, the adapter concurrency ban, and the domain DTO-import ban were silently inactive in live lint. Fixing this is in-scope (enforcement investigation) and requires a regression spec.
2. **`unicorn/no-nested-ternary` silently disabled** by `eslint-config-prettier` (applied last). Core `no-nested-ternary` must own the ban.
3. **Working-copy hygiene (pre-existing):** stale `node_modules` (bcrypt missing) and a CRLF working tree (repo-local `core.autocrlf=true`, no `.gitattributes`) made all gates red at HEAD. Root-cause fixes: `npm install`, `.gitattributes` with `* text=auto eol=lf`, worktree renormalization.
4. **One live violation revealed:** `auth.service.ts` held a module-level `verifyPassword` function — relocated to `src/modules/auth/lib/password.helpers.ts`.
5. **Existing owners to extend, not duplicate:** rules/06 §6 (search-before-create), rules/03 (size budgets), rules/13 (lint catalog), rules/15 (review gate), `docs/sdlc/code-review-checklist.md`, `docs/sdlc/engineering-standards.md`.

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                     | Owner                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| New rules take numbers 20–24; new non-negotiables take 43–46                                                                                                                                                                                                                                                                                 | Repository architect |
| `docs/sdlc/` stays flat: baseline goes to `docs/sdlc/simple-readable-code.md` (no `engineering/` subfolder); review-checklist content extends the existing `docs/sdlc/code-review-checklist.md`; AI-agent coding style folds into the baseline + entrypoints (no new `docs/ai-agent-coding-style.md` — extend-the-owner applies to docs too) | Repository architect |
| Mirrors and entrypoints carry a compact pointer only — rule bodies live once in `rules/`                                                                                                                                                                                                                                                     | Repository architect |
| ESLint additions limited to low-false-positive stock rules + reviving the dead overrides                                                                                                                                                                                                                                                     | Repository architect |

## Open questions

None remaining — all resolved in the decisions above.
