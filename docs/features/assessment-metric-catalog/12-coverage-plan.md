# Coverage plan

Touched logic includes assessment policies, repositories, use cases/query services, mappers, and
typed errors. Target is at least 95% statements/functions/lines and real branches; the repository
aggregate branch floor remains the documented 90% only for decorator-generated branches.

Critical paths targeted near 100%: weight totals, scale invariants, date ordering, scope probes,
published/used immutability, archive/concurrency conflicts, null/zero mapping, and transaction
audit/outbox behavior. Declarative DTOs, enums, constants, rows, module wiring, and migration DDL
are validated by contract/migration tests rather than coverage padding. No waiver is requested.

