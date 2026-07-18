# Impact analysis

Affected: backend API, PostgreSQL schema/seeds/indexes, assessment domain, RBAC route use, audit,
outbox, OpenAPI, tests, runbook, support dictionary, and later assessment consumers.

Unaffected: frontend implementation in this slice, mobile-native runtime, secrets/config,
third-party integrations, queues/workers beyond existing outbox storage, ingress, health checks,
and deployment manifests. The additive schema is backward compatible with the old application.

Reporting gains stable keys/versions. Privacy impact is low: no player values or private notes are
stored. Support must understand locked published versions and null-not-zero semantics. Migration
down is structurally reversible but removes feature data, so production rollback requires an export
or roll-forward decision.

