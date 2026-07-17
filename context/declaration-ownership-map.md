# Declaration Ownership Map

Rules decide; this file answers “where does it go?”

- Module value/route/message/error/provider/limit/allowlist → `src/modules/<feature>/model/<feature>.constants.ts`
- Module data contract/port/input/result → `model/<feature>.types.ts`
- Established interface-only split → descriptive `model/<feature>.interfaces.ts`
- Module enum → `model/<feature>.enums.ts`
- Cross-module enum → `src/shared/enums/<name>.enum.ts` plus `*_VALUES` and barrel export
- HTTP body/query/params/response → `api/dto/*.dto.ts`
- Mapper/formatter/pure validator/predicate → module `lib/`
- Business rule/invariant/transition → `domain/*.policy.ts` / state machine
- Persistence query/mutation → `infrastructure/*.repository.ts`
- Vendor SDK/client → `adapters/*.adapter.ts`; app-owned port/types remain outside vendor code
- Auth/guard/pipe/logger/error/HTTP contract → owning `src/core/<concern>/`
- Environment namespace/schema/parser → `src/config/`
- Generic dependency-light contract → `src/shared/{constants,types,interfaces,enums,utils}`
- Test fixture/builder → closest reusable test owner
- Public cross-module export → module/shared/core `index.ts` only when consumed

Implementation layers contain no anonymous parameter/result/generic shape, reusable declaration, DTO, config/permission map, or module helper. DTO framework fields use `declare readonly`, not `!`.

One-use framework call options may remain inline only when they carry no domain/security policy and extraction would be less readable.

Canonical rule: [rules/30](../rules/30-declaration-ownership.md). Procedure: [skills/refactor-inline-declarations.md](../skills/refactor-inline-declarations.md).
