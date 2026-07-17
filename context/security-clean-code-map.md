# Security Clean-Code Map

- Token/password/crypto vendor import → owning `adapters/*.adapter.ts`
- Token/password app contract + DI token → auth/core `*.types.ts` and `*.constants.ts`
- Decoded identity runtime validator → auth/core `lib/*.validator.ts`
- Public/current-user/permission decorators → cross-cutting auth/guard owner
- Roles and permissions → shared enums; role→permission map → shared constants
- Authentication decision → auth guard
- Permission decision → permissions guard/helper
- Resource owner/tenant decision → application/domain policy plus scoped repository
- Auth/permission/ownership errors → typed `AppError` and auth/module constants
- Security config/secret validation → `src/config/`
- Redaction paths/log policy → `src/core/logger/`
- Security tests → adapter/validator/guard units plus route e2e negatives

Order is fixed: validated token identity → auth guard → permission guard → owner/tenant scope → application defense → repository scope before count/pagination.

Never move a vendor call into `lib/`, trust client identity/permissions, merge controls to save files, reveal out-of-scope existence, or log credentials/tokens.

Use [skills/cleanup-security-code-without-weakening.md](../skills/cleanup-security-code-without-weakening.md).
