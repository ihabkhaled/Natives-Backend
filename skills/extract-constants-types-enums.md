# Skill: Extract Constants, Types, Interfaces, and Enums

## Intent

Move declarations to one discoverable owner without changing runtime behavior or creating duplicate files.

## When to use

Use when a layer file contains a constant, anonymous type/interface, enum, route/key/map, or repeated domain value; or when the same declaration exists in multiple places.

## When not to use

Do not extract a one-use framework options object that carries no domain/security policy and is clearer inline. Do not create a new owner when one already exists; extend it.

## Steps

1. Read the affected flow and tests; run the owner search in [reuse-before-creating.md](./reuse-before-creating.md).
2. Classify the declaration as module-local, cross-module, HTTP DTO, config/core, domain rule, or test fixture.
3. Write/update tests first if moving it can change runtime values, imports, validation, or enum behavior.
4. Move constants/maps/routes/message keys to `*.constants.ts`; object contracts to descriptive `*.types.ts`/established `*.interfaces.ts`; enums to `*.enums.ts` or shared `*.enum.ts` plus `*_VALUES`; DTOs to `api/dto/`.
5. Replace every call site and update intentional barrels only.
6. Delete the old/duplicate declaration and check for cycles (types must not depend on constants that depend on those types).
7. Run focused tests, lint, and typecheck; then update docs/context if ownership changed.

## Checklist

- [ ] Existing owner searched and reused.
- [ ] No inline/anonymous contract remains in implementation layers.
- [ ] No magic domain value or duplicate declaration remains.
- [ ] DTOs use `declare readonly`/constructors, not `!`.
- [ ] Vendor types did not cross an adapter boundary.
- [ ] Security, validation, auth, ownership, tests, and docs are unchanged or stronger.

## Related rules and skills

[rules/06](../rules/06-types-enums-constants.md) · [rules/22](../rules/22-reuse-before-creating.md) · [rules/30](../rules/30-declaration-ownership.md) · [refactor-inline-declarations.md](./refactor-inline-declarations.md) · [extract-helper-safely.md](./extract-helper-safely.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`. Never bypass hooks.
