# Declaration Ownership

Use one owner per concern.

## Feature module

- Constants, routes, message keys, maps, limits → `model/<feature>.constants.ts`
- Data contracts and ports → `model/<feature>.types.ts`
- Interfaces → an established descriptive `*.interfaces.ts` only when separated intentionally
- Enums → `model/<feature>.enums.ts`
- HTTP DTOs → `api/dto/*.dto.ts`
- Mapping/formatting/validation helpers → `lib/`
- Business decisions → `domain/*.policy.ts`
- Persistence → `infrastructure/*.repository.ts`
- Vendor calls → `adapters/*.adapter.ts`

## Cross-cutting

- Generic enums/constants/types/interfaces → `src/shared/*`
- Errors, guards, pipes, logger, HTTP contracts → owning `src/core/<concern>/`
- Environment namespaces/types/validation → `src/config/`
- Assembly constants/options → `src/bootstrap/` only when bootstrap owns them
- Test builders/fixtures → closest reusable test owner

## Forbidden

Anonymous request/result types in generics/signatures; inline DTOs/config/permission/status/route/provider maps; duplicate constants/validators/mappers; vendor types outside adapters; DTO definite-assignment `!`; feature contracts dumped into `shared`.

One-use framework call options may stay inline when they carry no domain/security policy and extraction would reduce readability.

See [context/declaration-ownership-map.md](../context/declaration-ownership-map.md) and [rules/30](../rules/30-declaration-ownership.md).
