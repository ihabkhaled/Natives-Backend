# 07 Technical roadmap

- Slice A: tests for optional session claim validation and issuance.
- Slice B: tests and implementation for active owner-scoped list/revoke queries.
- Slice C: tests and implementation for list, revoke-one, and revoke-others application operations.
- Slice D: public pending-invitation lookup tests and implementation.
- Slice E: DTO/controller/module wiring, HTTP tests, documentation, security review, and gates.

All work remains on `feat/ultimate-natives-completion`; the root orchestrator owns grouped commits and
push. Rollout is additive. Rollback removes the routes/providers and claim enrichment; no data rollback
is required.
