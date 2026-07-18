# Architecture review

`assessments` is a new bounded module matching the product module map. Controllers own transport
only; application use cases own multi-row transactions; pure policies own scale, weight, date, and
immutability rules; repositories own parameterized SQL; DTOs own bounds; model files own contracts.

Cross-module dependencies use the public `@modules/platform` audit/outbox surface. Teams/seasons are
referenced by foreign key and validated through assessment-owned read-only scope probes, avoiding a
deep import into `teams`. Global auth and permission guards extract path scope before delegation.

Public contract changes are additive team-scoped REST routes. Data flow is request → auth/RBAC →
scope/policy → one UnitOfWork transaction → assessment rows + audit/outbox. No topology, config,
vendor, or runtime change. ADR not required because this follows existing modular-monolith,
versioned-row, audit, and outbox decisions.
