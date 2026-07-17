# Validation Refactor Decisions

## Decision: boundary validation remains runtime behavior

TypeScript types are not validation. HTTP DTOs and targeted pipes retain every accepted field, bound, enum, coercion, unknown-field rule, and safe error mapping during refactors.

## Decision: DTO fields use declarations, not assertions

Framework-populated decorated fields use `declare readonly` (or constructor assignment where appropriate), never definite-assignment `!`.

## Decision: one validation owner

HTTP validation belongs to DTOs/core validation; environment validation belongs to config; business/state preconditions belong to application/domain. Duplicate service validation is removed only when every caller remains protected.

## Decision: all consumed config is fail-fast validated

Every environment key read by a config namespace is typed and constrained at startup. Every `.env.example` key is consumed. Invalid values fail boot; production secrets receive stronger presence/strength checks.

## Decision: validation failures are observable and safe

Failures map to typed message keys and structured non-sensitive logs. Raw validator/framework details do not leak to clients.

**See:** [rules/05](../rules/05-dto-and-validation.md) · [rules/17](../rules/17-configuration-and-environment.md) · [skills/cleanup-validation-code-without-weakening.md](../skills/cleanup-validation-code-without-weakening.md).
