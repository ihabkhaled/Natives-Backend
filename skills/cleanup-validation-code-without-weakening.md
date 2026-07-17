# Skill: Clean Up Validation Code Without Weakening It

## Intent

Consolidate validation ownership and simplify DTO/config/pipe code without removing a bound, accepted field, error key, or trust-boundary check.

## When to use

Use for duplicate service validation, inline DTO/request shapes, large validation pipes/factories, inconsistent config schemas, or repeated validators.

## When not to use

Do not move HTTP validation into services, rely on TypeScript types at runtime, enable implicit coercion broadly, or delete a check because the happy path passes.

## Steps

1. Inventory every accepted/rejected field, coercion, bound, nested rule, and message key; read DTO/pipe/e2e tests.
2. Write valid, invalid, missing, extra, and boundary tests first.
3. Put HTTP contracts in `api/dto/`; use named model contracts below the boundary.
4. Put reusable validators/normalizers in the owning `lib/`, `core/validation`, or `config/` concern only after an owner search.
5. Replace DTO definite-assignment `!` with `declare readonly`/constructor assignment; preserve decorators.
6. Remove duplicate service validation only after proving the boundary and any non-HTTP caller remain protected.
7. Map validation failures to typed sanitized `AppError`/message keys and preserve structured non-sensitive logging.
8. Keep every consumed environment key in the startup schema and remove every unused documented key as a complete surface.

## Checklist

- [ ] Every untrusted boundary remains runtime-validated and bounded.
- [ ] Unknown fields/coercion behavior is deliberate and tested.
- [ ] No inline DTO/request shape or `!` assertion.
- [ ] Non-HTTP callers cannot bypass required business preconditions.
- [ ] Validation errors remain typed, sanitized, observable, and documented.

## Related rules and skills

[rules/05](../rules/05-dto-and-validation.md) · [rules/17](../rules/17-configuration-and-environment.md) · [rules/18](../rules/18-error-handling-and-exceptions.md) · [create-dto-validation.md](./create-dto-validation.md) · [refactor-inline-declarations.md](./refactor-inline-declarations.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`.
