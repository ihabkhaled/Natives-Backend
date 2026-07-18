# Delivery plan

1. Add migration `1722300000000` with categories, scales, metric versions, template versions,
   category weights, required metrics, periods, indexes, constraints, and required seeds.
2. Add pure scale/weight/date/version policies and unit tests.
3. Add parameterized repositories, scope validation, audit/outbox-backed use cases, and query
   services.
4. Add validated DTOs, thin permission-gated routes, module wiring, and OpenAPI decorators.
5. Add migration/repository/real-PostgreSQL/concurrency/HTTP tests and documentation.
6. Run targeted then full honest gates; leave release/UAT/native evidence unverified until executed.

No feature flag or dependency is added. Rollout is migration first, application second. Abort on
seed/constraint failure, cross-team leakage, contract drift, or a red mandatory gate.
