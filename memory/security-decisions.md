# Security Decisions

> Durable security conventions for a NestJS backend in this workspace: authentication, RBAC, ownership/tenant isolation, secrets, rate limiting, and headers. Decisions + rationale, not just rules. Hard rules live in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and [07-security-authn-authz.md](../rules/07-security-authn-authz.md); this file records _why we chose what we chose_ and where a real project pins its specifics.

Every line marked **Project records:** is a placeholder a concrete project fills in once. Until then, treat the stated default as the house standard.

---

## How identity flows

The verified access token is the only source of identity. Decode it in the auth guard, attach a typed principal to the request, and read it downstream via a `@CurrentUser()` param decorator. **Never** trust a `userId`, `tenantId`, or `role` from the request body, query, or header.

```ts
// Don't — client-supplied identity is an IDOR/spoofing vector
@Post()
create(@Body() dto: CreateArticleDto): Promise<ArticleDto> {
  return this.service.create(dto.authorId, dto); // authorId came from the client
}

// Do — identity comes from the verified token
@Post()
// JwtAuthGuard then PermissionsGuard are wired globally.
@RequirePermissions(Permission.ArticleCreate)
create(
  @CurrentUser() actor: AuthUserIdentity,
  @Body() dto: CreateArticleDto,
): Promise<ArticleDto> {
  return this.createArticleUseCase.execute(actor, dto);
}
```

Decision: identity is established once, by the guard, from a verified token. **Rationale:** a single trusted source removes the "which field do I trust?" class of bugs.

---

## JWT and sessions

| Concern          | Decision                               | Default             | Tunable via config                          |
| ---------------- | -------------------------------------- | ------------------- | ------------------------------------------- |
| Access token     | short-lived, stateless                 | `15m`–`1h`          | `JWT_EXPIRES_IN`                            |
| Refresh token    | longer-lived, rotating, server-tracked | `7d`                | `JWT_REFRESH_EXPIRES_IN`                    |
| Signing          | separate secret per token type         | —                   | `JWT_SECRET`, `JWT_REFRESH_SECRET`          |
| Refresh delivery | HttpOnly + Secure + SameSite cookie    | —                   | cookie options in `config/`                 |
| Login lockout    | attempt cap + cooldown                 | 5 attempts / 15 min | `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION_MS` |

**Refresh-token rotation is mandatory.** On every refresh: revoke the old session record and issue a brand-new access + refresh pair. A refresh token is single-use. **Rationale:** a leaked refresh token is detectable (reuse of a revoked token signals compromise) and short-lived in effect.

**Rotation must be concurrency-safe via a grace window.** Two near-simultaneous refreshes with the _same_ old token (e.g. multiple tabs restoring a memory-only access token) race: the first revokes the session, the second finds nothing and would 401, killing a valid user. Decision: if no _active_ session matches but a _just-rotated_ session matches within a grace window (default `30s`, `REFRESH_ROTATION_GRACE_MS`), re-issue against the new session instead of failing — and do **not** revoke again. Apply the same logic to every refresh entry point (standard users and any privileged/admin auth path).

> Verified-token validation, lockout, and rotation logic live in the auth module's application layer (`<feature>.service.ts` / `<action>.use-case.ts`), never in the controller. Token signing/verification is wrapped behind an adapter — see [library-boundaries.md](./library-boundaries.md).

**Project records:** token lifetimes, cookie domain/SameSite policy, session store (DB table vs. cache), and whether privileged sessions get shorter lifetimes.

---

## RBAC — a central permission catalog

Authorization is a **separate, additional gate** after authentication. Authentication answers "who are you?"; authorization answers "may you do this?". Both run on every protected route.

Decision: permissions are fine-grained `<resource>:<action>` values held in **one central catalog**, never scattered string literals. Roles map to sets of permissions; the guard checks permissions, not roles. **Rationale:** features depend on capabilities, not titles; remapping a role never requires touching controllers.

```ts
// @shared/enums/permission.enum.ts
export enum Permission {
  ARTICLE_CREATE = 'article:create',
  ARTICLE_READ = 'article:read',
  ARTICLE_UPDATE = 'article:update',
  ARTICLE_DELETE = 'article:delete',
}
export const PERMISSION_VALUES = Object.values(Permission);

// @shared/constants/role-permissions.constant.ts — the role→permission map
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.Viewer]: [Permission.ArticleRead],
  [Role.Editor]: [
    Permission.ArticleRead,
    Permission.ArticleCreate,
    Permission.ArticleUpdate,
  ],
  [Role.Admin]: PERMISSION_VALUES, // full surface
} as const;
```

```ts
// Do — declarative requirement on the route, enforced by a guard
@Patch(':id')
// JwtAuthGuard then PermissionsGuard are wired globally.
@RequirePermissions(Permission.ArticleUpdate)
update(/* ... */): Promise<ArticleDto> { /* ... */ }
```

Conventions:

- Enums/maps live in dedicated files (rules 8, 12, 16); no inline permission strings in controllers, services, or guards.
- The full permission grant for the top admin role derives from the catalog (`PERMISSION_VALUES`) so new permissions are covered automatically — but high-blast-radius permissions (delete, export, impersonate, financial) are granted **explicitly**, never via a wildcard.
- A `@RequirePermissions` metadata decorator + `PermissionsGuard` is the sanctioned pattern. See [add-guard-and-permission.md](../skills/add-guard-and-permission.md).

**Project records:** the concrete permission list, the role taxonomy, and the role→permission map.

---

## Ownership and tenant isolation (defense-in-depth)

A permission says "EDITORs may update articles." It does **not** say "this editor may update _this_ article." That second check is **ownership/tenant scoping**, and it is the last line against IDOR and cross-tenant leakage.

Decision: every resource fetched by id is scoped to the actor in the application layer — even after the RBAC guard passes. Prefer scoping at the query (repository receives the actor's `tenantId`/`ownerId` and filters), and add an explicit ownership assertion for clarity and auditability.

```ts
// Do — scope at the data boundary AND assert ownership
async update(actor: AuthUserIdentity, id: string, dto: UpdateArticleDto): Promise<ArticleDto> {
  const article = await this.repository.findByIdForTenant(id, actor.tenantId);
  if (article === null) throw new ArticleNotFoundError(id); // not-found, not forbidden — don't leak existence
  this.ownershipPolicy.assertCanModify(actor, article); // domain policy, pure
  return this.repository.update(id, dto);
}
```

Conventions:

- Return **not-found** (not forbidden) for resources outside the actor's scope, so existence isn't leaked across tenants.
- Ownership decisions are a pure **domain policy** (`domain/`), unit-tested in isolation.
- Cross-tenant access is a _testable behavior_, not a belief — see [testing-strategy.md](./testing-strategy.md).
- An `OwnershipGuard` may handle the common case declaratively; bespoke rules stay in domain policies.

**Project records:** the tenancy model (single-tenant, row-scoped multi-tenant, schema-per-tenant), which entities are tenant-scoped, and the privileged-actor override (e.g. audited admin impersonation) rules.

---

## Secrets and configuration hardening

All secrets are typed config, validated at startup (rule 27, 29). **Never** read `process.env` outside `config/` or `bootstrap/`.

Decision: secret validation is stricter in production. The config schema:

- requires `NODE_ENV` plus every secret to be present and at least 32 UTF-8 bytes in every environment;
- in production, requires generated-looking base64url material (at least 43 characters for 32 bytes), rejects placeholders/repeated/sequential patterns, and requires a minimum unique-character count;
- **fails fast** — the app refuses to boot on an invalid secret rather than running insecurely.

```ts
// Don't — process.env in business code, no validation
const secret = process.env.JWT_SECRET ?? 'dev-secret';

// Do — typed, validated config injected where needed
constructor(private readonly config: AuthConfig) {}
sign(payload: TokenPayload): string {
  return this.jwtAdapter.sign(payload, this.config.accessSecret);
}
```

Rationale: a weak or placeholder secret is a silent catastrophe; making it a **loud boot failure** turns a security hole into a deploy-time error.

> Any "test convenience" toggle (e.g. a static verification code for QA) must be **triple-gated**: defaults off; the runtime path ignores it unless `NODE_ENV !== 'production'`; and the config schema _refuses to boot_ if the flag is on while in production. A convenience must never become a production bypass, and every use of it logs a `WARN`.

**Project records:** the secret inventory, rotation/expiry policy, the secret-management backend (vault/KMS/parameter store), and generation command (e.g. a CSPRNG-based generator — never `Math.random()`).

---

## Crypto and timing-safe comparisons

- Compare secrets, tokens, and one-time codes with a **constant-time** comparison (`crypto.timingSafeEqual`) — never `===`/`!==`. **Rationale:** naive comparison leaks length/prefix via timing.
- Hash passwords with a slow, salted KDF (bcrypt/argon2). Tune the work factor for production (e.g. bcrypt cost ≥ 12); the framework default is often too low — pin it in config, don't rely on the library default. Compare via the KDF's own verify function, never string equality on hashes.
- Generate tokens/codes with a CSPRNG (`crypto.randomBytes`), never `Math.random()`.
- Keep ESLint timing-attack / insecure-randomness detectors on so regressions are caught.

These helpers belong in `@shared/utils` (e.g. a `crypto.util.ts`), reused everywhere — never re-implemented per module.

**Project records:** the chosen KDF + work factor, and the one-time-code length/TTL/single-use policy.

**IronNest reference implementation:** `bcrypt` is isolated in `src/modules/auth/adapters/password-hash.adapter.ts`; `@nestjs/jwt` is isolated in the JWT adapter plus module registration. The in-memory demo user's fixed cost-10 hash is test/bootstrap data only, not a production work-factor recommendation. Production adopters must set and benchmark their own stronger KDF policy.

---

## Rate limiting

Decision: layered limiters, each keyed for its threat model. A single global limiter is not enough.

| Scope                    | Key             | Posture                  | Notes                                      |
| ------------------------ | --------------- | ------------------------ | ------------------------------------------ |
| Global / per-route       | IP (+ route)    | moderate                 | baseline DoS guard, applied app-wide       |
| Auth (login, OTP, reset) | `ip:identifier` | strict                   | identifier from the credential being tried |
| Token refresh            | **IP only**     | lenient, skip-successful | see below                                  |

The refresh endpoint has **no identifier in the body**, so an `ip:identifier` limiter buckets every refresh under `ip:unknown` and a shared IP/NAT or a multi-tab user gets 429'd unfairly. Decision: refresh uses a **dedicated IP-keyed limiter** that is lenient and only counts _failed_ attempts (`skipSuccessfulRequests`). **Rationale:** match the key to what the endpoint actually knows about the caller.

Wrap the limiter behind an adapter/guard so the store (in-memory vs. distributed cache) is swappable — see [library-boundaries.md](./library-boundaries.md) and [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md).

**Project records:** per-scope window/max values, the limiter store backend, and any per-tenant or per-plan overrides.

---

## HTTP security headers

Decision: set security headers **explicitly**, never rely on a library's evolving defaults. A baseline:

| Header                       | Stance                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Content-Security-Policy      | `default-src 'self'`; tighten per app; `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`, `form-action 'self'` |
| Strict-Transport-Security    | long max-age, `includeSubDomains`, `preload` (production)                                                               |
| X-Frame-Options / frameguard | `deny`                                                                                                                  |
| Referrer-Policy              | `strict-origin-when-cross-origin`                                                                                       |
| X-Content-Type-Options       | `nosniff`                                                                                                               |

CORS: never `origin: *` in production. Use an explicit origin **allowlist** with `credentials: true` only for trusted origins. If an edge proxy/gateway owns CORS, the app may skip per-request CORS — but that decision is configured and documented, not implicit.

Apply headers/CORS at the bootstrap layer (`bootstrap/`), the only place outside `config/` allowed to touch env. Wrap the header library behind a thin setup helper so the policy is one auditable place.

**Project records:** the exact CSP, the production origin allowlist, and whether the edge or the app owns CORS/headers.

---

## Input, output, and upload safety

- **Validate at the HTTP boundary** with DTOs (global `ValidationPipe`, `whitelist: true`, `transform: true`); strip unknown fields. See [05-dto-and-validation.md](../rules/05-dto-and-validation.md).
- **Bound request bodies** (a sane JSON size limit) as a DoS guard; uploads use a separate, explicit path.
- **Validate UUID/id route params** so malformed ids are rejected early.
- **Uploads are whitelist-based**, in order: per-asset-type MIME + extension + size whitelists → magic-byte (real-type) detection (don't trust the client MIME) → filename sanitization → malware scan via an antivirus adapter → write to object storage via the storage adapter. Health/readiness reports scanner health and degrades to 503 when the scanner is down. Wrap the scanner and storage as adapters — see [add-library-adapter.md](../skills/add-library-adapter.md).
- **Escape user-provided values** rendered into HTML (emails, server-rendered fragments) to prevent stored XSS.
- **No raw SQL string interpolation** — bind every value (rule 31). See [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md).

**Project records:** body-size limits, per-asset-type whitelists and size caps, and the malware-scanner/object-storage providers.

---

## Error and logging safety

- Every user-facing error is a typed `AppError` with a `messageKey` (`errors.<feature>.<key>`); the global exception filter maps it to an HTTP status and a **sanitized** body (rule 26, 36). See [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md).
- **Never** leak stack traces, SQL, secrets, tokens, or internal messages to clients. Full detail is logged server-side; production hides stacks from responses.
- **Redact before logging.** Sensitive fields (passwords, tokens, secrets, PII) are stripped from request/response payloads before they reach the logger. Use the logger adapter only — never `console.*` (rule 28). See [14-observability-and-logging.md](../rules/14-observability-and-logging.md) and [observability-decisions.md](./observability-decisions.md).
- **Audit privileged actions** (role/permission changes, impersonation, exports, deletes) to a durable, non-blocking audit trail. Audit failures must never block the action, but must be detectable. See [database-decisions.md](./database-decisions.md).

**Project records:** the redaction field list, the audit-log schema, and which actions are audited.

---

## Transport security

- Enforce TLS in production for every hop: client→app and app→datastore/cache. The data layer config warns (or fails) if TLS is off in production. See [database-decisions.md](./database-decisions.md).
- Keep non-production environments network-restricted (VPN/allowlist); convenience toggles are only as safe as access to the environment that hosts them.

**Project records:** TLS enforcement flags per datastore and the cert/rotation strategy.

---

## The security gate (every protected route)

```
JwtAuthGuard (verified token → principal)
  → PermissionsGuard (@RequirePermissions, central catalog)
    → OwnershipGuard / domain ownership policy (this actor, this resource)
      → application layer (re-scope queries to the actor; never trust client ids)
```

Skipping any link is a security defect, not a style nit. Reviewers reject routes missing any layer — see [security-review.md](../skills/security-review.md) and [15-review-checklist.md](../rules/15-review-checklist.md).

---

## Decision checklist

- [ ] Identity from the verified token only; never from client body/query/header
- [ ] Auth guard **and** permissions guard **and** ownership/tenant check on every protected route
- [ ] Permissions come from the central catalog; no inline permission strings; dangerous grants are explicit
- [ ] Refresh tokens rotate (single-use), concurrency-safe via a grace window; refresh limiter is IP-keyed and lenient
- [ ] Secrets validated at startup; production rejects weak/placeholder values and fails fast
- [ ] Constant-time comparison for secrets/tokens/codes; CSPRNG for tokens; tuned KDF for passwords
- [ ] Layered rate limiters keyed to each endpoint's threat model
- [ ] Security headers + CORS set explicitly; no `origin: *` in production
- [ ] DTO validation + bounded bodies + whitelist-based upload pipeline (real-type + scan)
- [ ] Sanitized errors with `messageKey`; redacted logs; privileged actions audited
- [ ] TLS enforced in production for every hop

---

**Related:** [07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [security-review.md](../skills/security-review.md) · [library-boundaries.md](./library-boundaries.md) · [known-pitfalls.md](./known-pitfalls.md)
