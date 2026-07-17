# 04 — Cross-Functional Refinement

## Participants

Repository architecture, backend engineering, QA/test engineering, application security, DevOps/release, documentation/support, and AI-agent maintainability were represented through repository policy, automated gates, and focused audits.

## Findings by function

- Architecture: keep the existing one-way layers; move contracts and access-control primitives to owners that do not make `core` depend on a feature module.
- Backend: eliminate direct JWT/bcrypt coupling, inline auth shapes, post-pagination owner filtering, DTO `!`, and stale config examples.
- QA: add unit tests for adapters, identity validation, permissions, ownership pagination, config parsing/validation, and lint rules; preserve e2e coverage.
- Security: use token-derived identity, central permissions, owner-scoped queries, non-enumerating not-found behavior, typed auth errors, redacted logs, and production secret validation.
- DevOps: no deployment change; startup validation and `.env.example` must stay aligned.
- Documentation/support: update reference patterns and practical navigation; avoid copying full rule bodies into mirrors.
- AI agents: add compact owner maps and cleanup procedures; `codex.md` already fulfills the GPT-family full mirror.

## Hidden work and integration points

Auth module wiring, global guard construction, public exports, e2e test bootstrap, package-import boundaries, config DTO/vendor re-exports, and coverage include paths must change together.

## Open questions and decisions

- Separate GPT Sol file: rejected because `codex.md` is already the full GPT mirror; accepted by repository owner instruction.
- Heavy magic-string lint: document the gap; AST enforcement would have high false-positive risk.
- File splitting: only where a real responsibility seam exists; no runtime source file currently requires a facade split solely for size.

## Owners

Implementation/docs: delivery agent. Quality and security evidence: automated suite plus focused review. Final merge/release approval remains external to this work session.
