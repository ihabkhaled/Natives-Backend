# Skill: Security Review

> Audit a change for auth/authz/IDOR/secrets/headers/error-leakage before merge. This skill applies the security canon — run it on every PR that touches controllers, guards, services, repositories, DTOs, adapters, file handling, or config.

## Rules this skill enforces

- **Authn on every protected route** — auth guard; identity from the verified token, never the client body ([00 rule 33](../rules/00-non-negotiable-rules.md)).
- **Authz on every protected route** — permissions/RBAC guard from a central catalog; authentication ≠ authorization ([rule 34](../rules/00-non-negotiable-rules.md)).
- **Ownership/tenant check on every resource accessed by id** — blocks IDOR/cross-tenant reads ([rule 35](../rules/00-non-negotiable-rules.md)).
- **No leakage** — no stacks/SQL/secrets/PII to clients or logs; the exception filter returns sanitized `{ messageKey }` ([rules 28, 36](../rules/00-non-negotiable-rules.md), [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).
- **Validation at the boundary** via DTOs; parameterized + bounded queries ([rule 25, 31, 37](../rules/00-non-negotiable-rules.md)).
- **`process.env` only in `config/`/`bootstrap/`**; external libs only behind adapters ([rules 27, 32](../rules/00-non-negotiable-rules.md)).

Full detail: [07-security-authn-authz.md](../rules/07-security-authn-authz.md). Deep dives: [sql-injection-review.md](./sql-injection-review.md), [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md).

---

## Steps (ordered — copy along the diff)

### 1. Scope the review to the diff

Review only what changed; list the security-relevant files first.

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- 'src/modules/**/api/**' 'src/core/guards/**' 'src/modules/**/infrastructure/**' 'src/**/adapters/**'
```

Then use the **Grep tool** (not raw `rg` — results link in the UI) to find risk patterns:

| Risk | Grep pattern | Glob |
| --- | --- | --- |
| Routes missing guards | `@(Get\|Post\|Put\|Patch\|Delete)\(` | `**/*.controller.ts` |
| Raw/interpolated SQL | `query\(\s*\`` and `\.query\(.+\$\{` | `**/infrastructure/**` |
| Secret/PII logging | `logger\.(log\|info\|debug\|warn\|error)\(.*(password\|token\|otp\|secret)` | `src/**` |
| `process.env` escapes | `process\.env` | `src/**` (must hit only `config/`/`bootstrap/`) |

### 2. Authn + Authz on every protected route

Every protected route chains, in order: **auth guard → permissions guard → ownership/tenant check**. Permissions come from a central catalog, never inline strings.

```ts
// DO — full guard chain, central permission catalog, DTO validation, thin delegation
@Post()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions(Permission.OrderCreate) // from @shared/constants permission catalog
create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
  return this.createOrder.execute(user, dto); // identity from the token, not the body
}
```

```ts
// DON'T — no guards; raw permission string; trusting a client-supplied owner id
@Post()
create(@Body() dto: { ownerId: string }): Promise<OrderResponseDto> { // BLOCKER: no authn/authz
  return this.service.create(dto.ownerId, dto); // BLOCKER: ownerId from client body
}
@Get(':id')
@RequirePermissions('order:read') // BLOCKER: magic string — use the enum catalog
findOne() { /* ... */ }
```

Verify per handler:

- [ ] Non-public route has **both** an auth guard and a permissions guard.
- [ ] Permission is an enum member from the central catalog (`Permission.*`) — no inline string ([rule 8, 9](../rules/00-non-negotiable-rules.md)).
- [ ] Admin-only endpoints check an admin permission, not merely "authenticated".
- [ ] Public routes are **intentionally** public, rate-limited, and expose no sensitive data.

### 3. IDOR + tenant isolation

Any handler accepting `:id`/`ownerId`/`resourceId` must confirm the caller owns the resource (or holds an override permission). Enforce in the application layer, scoped by the token's identity.

```ts
// DO — ownership/tenant scope derived from the verified identity, defense-in-depth
async findForUser(user: AuthUser, id: string): Promise<Order> {
  const order = await this.orders.findByIdAndTenant(id, user.tenantId); // scoped query
  if (order === null) throw new OrderNotFoundError(id); // same shape as "not yours" → no enumeration
  this.ownershipPolicy.assertCanRead(user, order); // domain policy, explicit
  return order;
}
```

```ts
// DON'T — fetch by id alone, return cross-tenant data (classic IDOR)
async findOne(id: string): Promise<Order> {
  return this.orders.findById(id); // BLOCKER: any user reads any tenant's order
}
```

- [ ] Resource lookups filter by the caller's tenant/owner from the token, not a body/query field.
- [ ] "Forbidden" and "not found" return indistinguishable responses to avoid id enumeration.

### 4. Input validation, injection & SSRF

- [ ] Every body/query/param flows through a DTO (`api/dto/`) with class-validator (or the Zod pipe); no raw `@Body()` of `any` reaching a service ([05-dto-and-validation.md](../rules/05-dto-and-validation.md)).
- [ ] Id params validated (`@IsUUID()` / typed pipe) before use.
- [ ] No string-interpolated SQL; all dynamic values are bound parameters via the repository ([sql-injection-review.md](./sql-injection-review.md)).
- [ ] No `new RegExp(userInput)` and no nested-quantifier regex (ReDoS) — escape/whitelist first.
- [ ] **SSRF**: any outbound URL built from user input (webhooks, an email provider, object storage, an SMS gateway) is validated against an allowlist host inside its adapter — never fetch arbitrary user URLs.

### 5. Secrets, crypto & config

```ts
// DO — typed config, constant-time secret comparison, CSPRNG
const token = randomBytes(this.config.tokenBytes).toString('hex');
const matches = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
```

```ts
// DON'T
const secret = process.env.TOKEN_SECRET;     // BLOCKER outside config/ + bootstrap/
const code = Math.random().toString();       // not a CSPRNG
if (provided === expected) { /* ... */ }      // timing leak on secret compare
```

- [ ] No `process.env` outside `config/`/`bootstrap/`; secrets read via typed config only ([17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)).
- [ ] Secret/token/OTP comparison is constant-time; tokens come from a CSPRNG, not `Math.random()`.
- [ ] Hashed credentials use a strong KDF; refresh tokens are stored hashed and rotated on refresh.
- [ ] No secrets/tokens/PII in logs — redact before logging via the logger adapter ([14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

### 6. Error & transport hygiene

- [ ] No stack traces, raw DB errors, SQL, or internal messages reach the client; the global exception filter maps typed `AppError`s to a sanitized body. Every user-facing error carries `errors.<feature>.<key>` ([16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)).
- [ ] Security headers (CSP/HSTS/frameguard/referrer-policy) set explicitly, not framework defaults.
- [ ] CORS is an allowlist in production, never `*`.
- [ ] Rate limiting on sensitive endpoints: login, OTP, password reset, registration, public reads.
- [ ] Transport encryption (TLS) enforced for datastore and cache connections in production.

---

## Tests FIRST

Write/adjust the tests before the fix — a security behavior change is a behavior change ([rule 42](../rules/00-non-negotiable-rules.md), [coverage-policy.md](../testing/coverage-policy.md)). For each finding add:

- A `401` test (no token) and a `403` test (authenticated, lacks permission) — see [write-integration-tests.md](./write-integration-tests.md).
- An **IDOR test**: user A cannot read or modify user B's resource (returns `404`/`403`).
- A malicious-payload test for any new query path — see [sql-injection-review.md](./sql-injection-review.md).
- A redaction test asserting no secret/PII appears in serialized error bodies or log output.

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings (security + architecture rules)
npm run typecheck       # tsgo --noEmit
npm run test            # all suites
npm run test:coverage   # touched modules >= 95%, critical paths near 100%
npm run build
```

Never bypass Husky hooks with `--no-verify`.

---

## Pitfalls

- **Authenticated but not authorized.** An auth guard alone is not enough — a permissions guard must run too. Verify both are present.
- **Ownership in the repository only.** Tenant scoping belongs in the query *and* a domain policy assertion; relying on the ORM filter alone breaks the moment a new query path bypasses it.
- **Trusting body identity.** `dto.ownerId`/`dto.tenantId` from the client is forgeable — always derive identity from `@CurrentUser()`.
- **Leaky "not found vs forbidden".** Distinct responses let attackers enumerate ids; return the same shape.
- **Secrets in error objects.** A thrown DB error can carry SQL/connection strings; ensure the filter strips `cause`/internal fields, never spreads raw errors into the response.
- **`process.env` smuggled into a service.** ESLint blocks it, but a re-export from a shared file can sneak it in — trace the import to a `config/` source.
- **Adapter bypass for outbound calls.** Direct SDK/HTTP use scatters SSRF and secret-handling risk; route every external call through an adapter ([add-library-adapter.md](./add-library-adapter.md)).

---

Related: [07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [sql-injection-review.md](./sql-injection-review.md) · [add-guard-and-permission.md](./add-guard-and-permission.md) · [create-error.md](./create-error.md) · [add-library-adapter.md](./add-library-adapter.md) · [write-integration-tests.md](./write-integration-tests.md) · [backend-security-reviewer.md](../agents/backend-security-reviewer.md) · [security-decisions.md](../memory/security-decisions.md) · [known-pitfalls.md](../memory/known-pitfalls.md)
