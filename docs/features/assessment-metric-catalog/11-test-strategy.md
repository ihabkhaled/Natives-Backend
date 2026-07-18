# Test strategy

| Risk / requirement | Evidence |
| --- | --- |
| scale bounds, step, kind/unit combinations | pure policy unit tests |
| category weights total 100 and no duplicates | pure policy + use-case tests |
| period start/end and season scope | policy/use-case + HTTP tests |
| immutable published versions | use-case + repository integration tests |
| archive-in-use and stale optimistic version | use-case + real PostgreSQL concurrency tests |
| null is not zero | mapper/policy/HTTP contract assertions |
| deterministic bounded lists | repository unit/integration and validation tests |
| team/season authorization | guard metadata plus HTTP 401/403/cross-team 404 tests |
| migration/seed/rollback | mocked round-trip assertions plus real PostgreSQL up/down |
| audit/outbox atomicity | use-case call-order/rollback and persisted-row integration assertions |

Fixtures use synthetic UUIDs, fixed UTC time, stable seed keys, and no production data. Unit tests
mock ports; persistence tests use the disposable `_test` PostgreSQL database when reachable. No
arbitrary sleep is allowed.

