# 08 — Architecture Review

## Boundary decisions

- `data-source.provider.ts` owns only normal connection initialization and readiness behavior.
- Explicit database creation is operational database tooling, not runtime application behavior.
- Seed configuration stays in `src/config`; seed SQL stays in `src/database`.
- Identity consumes auth and RBAC through `@modules/auth`, `@modules/rbac`, and the core permission port, never cross-module internals.
- HTTP declarations stay in `api/dto`; application result types stay in `identity/model`; mapping stays in `identity/lib`.

## Contract/data flow

`login DTO → LoginUseCase transaction → session issuance → permission resolver → identity mapper → LoginResponseDto`.

`db:setup → explicit database ensure → TypeORM migrations → explicit admin seed transaction`.

No schema or event changes. No ADR is required because the work restores the documented architecture rather than introducing a new architecture.

Architecture risks: circular RBAC/identity wiring and deep-import leakage. Verification: module compile/boot tests, lint boundary rules, and public-surface imports.
