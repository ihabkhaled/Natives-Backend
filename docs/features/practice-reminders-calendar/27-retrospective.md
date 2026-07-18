# 27 — Retrospective

What worked:

- Writing RFC ICS, token scope, quiet-hour, reminder, and retry tests first
  exposed folding, CRLF, and dedupe semantics early.
- Digest-only credentials and generic lookup failure kept privacy decisions
  structural.
- Bounded keyset fanout reused the platform outbox and preference model.

What to improve:

- Coordinate canonical OpenAPI generation only after all parallel public
  boundaries settle.
- Give each database-backed E2E suite an isolated database/schema so concurrent
  coverage runs cannot disconnect or overwrite another suite's fixtures.
- Add push/email only with a persisted delayed-delivery design that enforces
  quiet hours and preserves urgent-cancellation override.

No production outcome or client feedback is claimed before release/UAT.
