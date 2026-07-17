# 30 — Declaration Ownership

> Every declaration has one discoverable owner. Layer files import contracts and values; they do not become hidden declaration catalogs.

## Forbidden inline in implementation layers

Controllers, services, use cases, repositories, adapters, guards, pipes, interceptors, filters, handlers, and config/bootstrap consumers must not define reusable constants, type aliases, interfaces, enums, DTOs, request/response shapes, config/permission/status/route/error/event/provider maps, pagination/sort/filter allowlists, or module-level helper functions.

Inline object **values** passed to a framework API are allowed only when they are one-use framework call options, carry no domain/security policy, and are clearer at the call site. Reusable or policy-bearing maps are declarations and must be extracted.

## Canonical owners

- Module constants/maps/routes/error keys → `src/modules/<feature>/model/<feature>.constants.ts`.
- Module types/interfaces/ports → `model/*.types.ts` (use a dedicated `*.interfaces.ts` only when the module already distinguishes interface contracts).
- Module enums → `model/*.enums.ts`; cross-module enums → `src/shared/enums/*.enum.ts` with `*_VALUES`.
- HTTP request/response contracts → `api/dto/*.dto.ts`.
- Mappers/formatters/validators/pure guards → module `lib/`.
- Business rules/invariants → `domain/*.policy.ts`.
- Cross-cutting infrastructure contracts → the owning `src/core/<concern>/`.
- Generic dependency-light contracts → `src/shared/{constants,types,interfaces,enums}`.
- Environment/config contracts and validation schemas → `src/config/`.
- Test fixtures/builders → colocated test support or `test/` owner.

## Magic values

Routes, statuses, roles, permissions, event/message/error/config/provider/cache keys, TTLs, limits, and allowlists use named constants/enums. Tests may use scenario literals when the literal is the behavior under test.

## Dependency rules

Types may not import constants that import those types. Vendor types never cross adapters. Domain/use cases do not import API DTOs. Shared remains domain-safe and does not import feature modules. Public exports expose only cross-module contracts.

## Review checklist

- [ ] Search found no existing owner before a new declaration file was added.
- [ ] Layer files contain only their primary class/function and imported owners.
- [ ] No anonymous request/result/config/permission shape remains in a signature or generic.
- [ ] DTOs use `declare`/constructors rather than definite-assignment assertions.
- [ ] Barrels expose only intentional public contracts with no cycle.

**Related:** [06-types-enums-constants.md](./06-types-enums-constants.md) · [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [26-helper-driven-maintainability.md](./26-helper-driven-maintainability.md) · [../context/declaration-ownership-map.md](../context/declaration-ownership-map.md) · [../skills/refactor-inline-declarations.md](../skills/refactor-inline-declarations.md)
