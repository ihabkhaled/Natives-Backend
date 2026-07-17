# Skill: Refactor Inline Declarations

## Intent

Remove inline declarations from controllers, services, use cases, repositories, adapters, guards, pipes, interceptors, filters, handlers, and config consumers while preserving behavior.

## When to use

Use for module-level declarations, anonymous parameter/result/generic shapes, inline DTOs, permission/status/config maps, helper functions, and definite-assignment DTO fields.

## When not to use

Do not mechanically extract local variables that are part of a method's readable flow. Do not move domain policy into `shared` merely to satisfy a filename rule.

## Steps

1. Read the implementation and all tests; record current public signatures and error/security behavior.
2. Run [reuse-before-creating.md](./reuse-before-creating.md) to locate the existing owner.
3. Add characterization tests first when the declaration has runtime values, validation decorators, mapping, or security meaning.
4. Route the declaration through [context/declaration-ownership-map.md](../context/declaration-ownership-map.md).
5. Import the owner with type-only imports where appropriate; replace anonymous shapes with named contracts.
6. For DTOs, replace `!` with `declare readonly` or constructor assignment without changing boundary decorators.
7. Remove the old declaration, update barrels/module wiring, and verify no cycle or vendor type leak.
8. Run the focused spec before proceeding to the next file.

## Checklist

- [ ] One declaration owner; no parallel duplicate.
- [ ] Implementation file contains only its primary layer class/function.
- [ ] Validation/auth/permissions/ownership/error keys remain.
- [ ] Public contract and runtime value are deliberate and tested.
- [ ] Imports/exports are minimal and cycle-free.

## Related rules and skills

[rules/28](../rules/28-codebase-refactor-discipline.md) · [rules/30](../rules/30-declaration-ownership.md) · [extract-constants-types-enums.md](./extract-constants-types-enums.md) · [full-codebase-cleanup.md](./full-codebase-cleanup.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`. No suppressions or hook bypasses.
