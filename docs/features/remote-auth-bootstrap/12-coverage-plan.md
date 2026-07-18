# 12 — Coverage Plan

Touched logic:

- `src/config/seed-admin.config.ts`
- `src/database/ensure-database.ts`
- database setup/seed helpers
- `src/modules/identity/application/login.use-case.ts`
- `src/modules/identity/lib/identity.mapper.ts`

Targets: at least 95% statements/functions/lines and real branches on each touched logic owner; critical credential, SQL-identifier, transaction, and login authorization branches near 100%. DTOs, enums, constants, module wiring, and CLI entrypoints are declarative/integration-owned and follow the repository coverage policy.

Evidence: targeted Vitest output plus repository `test:coverage`. No waiver is planned.
