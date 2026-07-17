# 19 — Threat Model

## Scope and assets

JWT identity, password verification, role/permission catalog, owner-scoped article data, environment secrets/config, sanitized errors, and logs.

## Trust boundaries

HTTP input → DTO/targeted validation; authorization header → JWT adapter/runtime identity validator; identity → permission guard; identity/resource id → application/repository ownership scope; environment → startup validator; vendor exception → adapter/error filter; runtime data → logger redaction.

## Threat scenarios and mitigations

- Forged/malformed JWT claims: adapter verifies signature then runtime-validates user id/email/known roles; invalid returns typed 401.
- Client-supplied identity/permissions: controllers use verified `@CurrentUser`; permissions derive from the server-owned role map.
- Missing authorization control: article methods declare permissions; global auth then permission guards run in fixed order.
- IDOR/cross-owner enumeration: owner id is required by repository reads/lists; scope precedes count/pagination; out-of-owner id is 404.
- Credential enumeration: missing user and wrong password share `errors.auth.invalidCredentials`.
- Vendor leakage/coupling: JWT/bcrypt imports confined by tested package boundaries.
- Weak signing secret/environment downgrade: startup requires `NODE_ENV` and a minimum-length secret everywhere; production also rejects placeholders and low entropy.
- Secret/token/password logging: Pino redaction paths retained; e2e logs show authorization redacted.
- Unsafe framework errors: known paths use `AppError`; other 4xx responses map to safe status-specific keys/text.
- Availability via unbounded list: DTO and repository cap remain 100; owner filter happens before paging.

## Abuse cases

Repeated login attempts remain subject to the existing global limiter; the reference app does not implement account lockout/refresh sessions. Those are product-level future features, not silently added here.

## Residual risk

- Role permissions are an in-process reference map; production adopters may require a dynamic permission store and invalidation.
- No external penetration test was run.
- The demo fixed password hash/user must never be used as a production account.

Residual risk is acceptable for local reference implementation review, not sufficient alone for production release.
