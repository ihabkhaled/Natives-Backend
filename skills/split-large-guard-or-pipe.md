# Skill: Split a Large Guard or Pipe

## Intent

Keep a guard focused on one access decision and a pipe focused on one boundary transformation, with policies/validators owned and tested separately.

## When to use

Use when a guard parses credentials, validates payloads, resolves permissions, and decides ownership in one class; or when a pipe mixes parsing, validation policy, mapping, and error response construction.

## When not to use

Do not combine auth, permissions, and ownership to reduce file count. Do not split a short guard/pipe whose single decision is already obvious.

## Steps

1. Read route wiring, metadata decorators, request contracts, errors, and guard/pipe tests; pin every allow/deny/error-key branch first.
2. Identify the one responsibility that remains in the guard/pipe.
3. Move token/vendor work to an adapter, permission/ownership decisions to a central helper/policy, parsing/validation to a named validator, and contracts/constants to their owners.
4. Keep execution order explicit: authentication → permissions → ownership → DTO/targeted validation.
5. Normalize expected failures to typed `AppError`/message keys; never leak vendor/framework details.
6. Update module/global wiring and route metadata without weakening protected routes.
7. Test public/missing/invalid/denied/allowed cases and request mutation only after validated identity.

## Checklist

- [ ] Guard/pipe has one decision/transformation.
- [ ] No inline request shape, metadata key, permission map, or vendor import.
- [ ] Auth/authorization/ownership order and fail-closed behavior remain.
- [ ] Validation bounds and typed error keys remain.
- [ ] Focused unit and route-level tests pass.

## Related rules and skills

[rules/05](../rules/05-dto-and-validation.md) · [rules/07](../rules/07-security-authn-authz.md) · [rules/18](../rules/18-error-handling-and-exceptions.md) · [rules/30](../rules/30-declaration-ownership.md) · [cleanup-security-code-without-weakening.md](./cleanup-security-code-without-weakening.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build` · `npm run security:scan`.
