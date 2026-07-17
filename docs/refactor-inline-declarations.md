# Refactor Inline Declarations

Implementation layers import declarations from owners; they do not hide contracts inside signatures, generics, or module scope.

## Common moves

- `const LIMIT = ...` in a service/repository → existing module `model/*.constants.ts`.
- `type Result = ...` or `Promise<{...}>` → `model/*.types.ts`.
- request/response body shape → `api/dto/*.dto.ts`.
- role/permission/status/event/provider strings → canonical enum/constants catalog.
- repeated mapper/validator → module `lib/`.
- business predicate → `domain/*.policy.ts`.
- vendor request/response type → adapter-local app-owned model contract.
- DTO `readonly field!: T` → decorated `declare readonly field: T`.

## Safe procedure

1. Read all call sites and tests.
2. Search for an existing owner.
3. Add characterization tests when a value, decorator, mapping, or security rule can change.
4. Move one declaration without renaming the public contract.
5. Update type-only imports and intentional barrels.
6. Delete the old/duplicate declaration.
7. Check cycles and run focused gates.

Do not extract method-local values that simply make a readable recipe. The target is reusable/domain structure, not every `const` inside a method.

Canonical rule: [rules/30-declaration-ownership.md](../rules/30-declaration-ownership.md). Procedure: [skills/refactor-inline-declarations.md](../skills/refactor-inline-declarations.md).
