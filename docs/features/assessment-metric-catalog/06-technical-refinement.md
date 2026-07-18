# Technical refinement

The chosen model uses append-only version rows for metric definitions and templates. A stable
`definition_key`/`template_key` groups versions; consumers pin row IDs. Categories and scales are
also version-addressable seed data, while team custom definitions may reference seeded scales.
Template child rows carry category weights and required metric IDs in the same transaction.

Mutable draft/archive state uses optimistic `version` predicates. Publishing is a guarded one-way
transition and writes audit plus a versioned outbox event atomically. Periods are scoped records
with inclusive date-only bounds. Lists use limit/offset capped at 100 with stable tie-breakers.

Alternatives rejected:

- JSON-only templates: weak referential integrity and hard-to-query weights.
- Updating used rows in place: destroys historical interpretation.
- Duplicating team/season aggregates: violates module ownership.
- A new ORM/dependency: unnecessary; existing parameterized transaction scope is sufficient.

Trade-off: normalized child rows require a transaction and joins, accepted for correctness and
auditability.
