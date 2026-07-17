# 08 — Architecture Review

## Current architecture

The canonical controller → application → domain → persistence → integration flow and cross-cutting `core`/`config`/`shared` roots remain unchanged.

## Impact by area

- Controllers: stay one-delegation; route and permission metadata use named owners.
- Application: auth/article services retain focused orchestration and model-owned contracts.
- Domain/lib: identity and ownership decisions move to pure validators/mappers/policies where meaningful.
- Persistence: article queries take required owner identity and paginate only the scoped set.
- Integration: JWT and bcrypt become module-owned adapters behind app-owned ports.
- Core: public/current-user/permission guard primitives become cross-cutting and no longer require core health to import a feature module.
- Shared: canonical `Role` and `Permission` enums plus the role-permission map.
- Config/bootstrap: all consumed environment values are validated; provider wiring remains explicit.
- ESLint: existing plugin is extended, not replaced.

## Boundary changes

- Business code no longer imports `@nestjs/jwt` or `bcrypt`.
- Auth identity/guard contracts move to a cross-cutting owner so feature modules can consume them without private cross-imports.
- Role checks become permission checks from a central catalog.
- API DTOs remain boundary-owned; model types carry application contracts.

## Contract and data-flow changes

JWT payloads are runtime-validated before attachment to the request. Unauthorized/forbidden paths use typed message keys. Article reads/lists are scoped by verified identity before pagination and total calculation.

## ADR decision

No new ADR is required because the canonical architecture is not changed; this work makes the implementation conform to it. Durable implementation choices are recorded in `memory/`.

## Architecture risks

Dependency-injection token wiring and global guard order are the main risks. Unit/e2e module boot tests and package-boundary tests are required before readiness.
