# Validation-Safe Refactoring

Types do not validate runtime input. Every trust boundary keeps explicit, bounded validation.

## HTTP DTO cleanup

- Keep request/response classes in `api/dto/`.
- Preserve every decorator, accepted field, bound, enum, coercion, and unknown-field policy.
- Use `declare readonly`, not definite-assignment `!`.
- Pass named model contracts below the HTTP boundary where coupling would otherwise leak.
- Keep targeted route validation mapped to typed safe errors.

## Config cleanup

- Every consumed env key has a typed startup validation rule.
- Every documented env key is consumed; delete unused keys across example/schema/type/parser/docs.
- Malformed values fail boot rather than silently falling back.
- Production secrets receive stricter presence/strength validation.

## Tests first

Cover valid, missing, extra, malformed, lower/upper boundary, enum, coercion, nested, and sanitized error cases. Remove duplicate service validation only when all callers remain protected and stateful business preconditions stay in the application/domain layer.

Use [skills/cleanup-validation-code-without-weakening.md](../skills/cleanup-validation-code-without-weakening.md), [rules/05](../rules/05-dto-and-validation.md), and [rules/17](../rules/17-configuration-and-environment.md).
