# 27 — Retrospective

## What went well

- Existing rules 20–24 were extended instead of duplicated.
- Tests exposed implementation gaps before code changes.
- Auth/vendor/permission/ownership/config responsibilities now have clear owners.
- Static-rule activation tests caught override-order and AST double-report issues.
- All local gates, coverage, build, and security scan are green.

## What did not go well

- Previous governance claimed complete alignment while live auth/config/examples still had exceptions.
- Coverage and agent docs contained threshold/rule-range drift.
- Repository-wide documentation volume makes synchronization expensive.

## Improvements

- Keep executable activation/package-boundary tests for every new static promise.
- Treat reference patterns and `.env.example` as production artifacts.
- Prefer compact map/index updates over copied policy bodies.
- Run owner-scope, typed-error, and production-secret tests on every auth/config refactor.

## Follow-up actions

- Repository owner performs final review/approval.
- Independent QA/security approval before production use.
- Dependency updates are a separate request with compatibility testing.
- Complete release/hypercare artifacts only after an actual deployment.

## `claude.md` update

Updated with rules 20–30 ownership/refactor/agent philosophy, compact Mistral entrypoint role, GPT mirror decision, no anonymous contracts/DTO assertions, and the documented real-branch coverage interpretation.

## Postmortem

Not applicable: no incident, failed release, or escaped serious defect occurred. Accepted by repository architect for this local implementation.
