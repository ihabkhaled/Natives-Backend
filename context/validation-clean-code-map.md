# Validation Clean-Code Map

- HTTP body/query/params/header → `api/dto/*.dto.ts`
- Global class-validator/class-transformer ownership → `src/core/validation/`
- Targeted reusable pipe → `src/core/pipes/` or owning module pipe
- Reusable pure field/cross-field validator → owning module `lib/` or core validation
- Application/state precondition → application/domain policy, not duplicated DTO validation
- External provider response validation → adapter boundary
- Environment schema/DTO/parser → `src/config/`
- Validation constants/bounds/message keys → module/config constants owner
- Safe validation error mapping/logging → core validation + `AppError` filter

DTO decorated fields use `declare readonly`; no `!`. Every accepted field is decorated, strings/arrays/numbers are bounded, coercion is explicit, unknown-field behavior is deliberate, and tests cover valid/invalid/missing/extra/boundary cases.

Every consumed environment key is typed and validated at startup; every documented key is consumed. Invalid values fail boot.

Use [skills/cleanup-validation-code-without-weakening.md](../skills/cleanup-validation-code-without-weakening.md).
