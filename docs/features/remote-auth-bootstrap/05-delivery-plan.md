# 05 — Delivery Plan

1. Pin tests for config, database ensure, seed behavior, mapper, login use case, and HTTP contract.
2. Remove database ensure from runtime provider and add explicit `db:ensure`/`db:setup` tooling.
3. Refactor seed declarations and imports into their correct owners; keep password runtime-only.
4. Finalize the nested login model/DTO/mapper and module wiring.
5. Update database, identity, API, and setup documentation.
6. Run targeted suites, then format, lint, typecheck, coverage, and build.

Dependencies: migrations must run before seeding; RBAC roles must exist before assigning the admin bundle.

Rollout: coordinate the breaking login response with the frontend; run explicit DB setup only in approved local/bootstrap environments.

Rollback: restore flat login mapping/client together; remove explicit seed data through an operator-approved data change. Runtime startup remains safe because it never creates databases.
