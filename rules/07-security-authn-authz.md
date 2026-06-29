# 07 — Security: Authentication, Authorization, and Hardening

> The house standard for backend security in this workspace. It implements the security canon in [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) (rules 33–37) and the request lifecycle in [/context/architecture-map.md](../context/architecture-map.md). Authentication, authorization, and tenant isolation are **three distinct controls** — every protected route chains all three. These rules are non-negotiable; no ticket, prompt, or local habit relaxes them.

Every control below lives in a **dedicated place in the right layer** (guards in `core/guards/`, the permission catalog in `shared/`, ownership checks in the application layer). Reuse them — never inline a one-off auth check in a controller or service.

---

## 0. The five rules you will most often forget

1. **Every protected route chains an auth guard → permissions (RBAC) guard → ownership/tenant check** — in that order. Authentication ≠ authorization ≠ ownership (rules 33–35).
2. **Identity comes from the verified token, never the request body.** Read the actor's id, tenant, and roles from `@CurrentUser()`; treat any user/tenant/owner field in the body or query as untrusted input.
3. **Permission strings come from the central catalog** in `shared/` — never a raw `'order:create'` literal scattered in code (rules 8/34).
4. **Every secret/token/HMAC comparison is timing-safe** (`crypto.timingSafeEqual`), never `===`.
5. **Every user-facing error is a typed `AppError` with a `messageKey`** (`errors.<feature>.<key>`) and is sanitized by the global exception filter — no stacks, SQL, tokens, or internal detail leak to clients (rules 26/36).

---

## 1. Authentication — identity from the verified token

A single global **auth guard** (`core/guards/jwt-auth.guard.ts`) verifies the bearer token on every route. Opt **out**, never in: routes are protected by default; only `@Public()` skips authentication.

- The guard verifies the token with the **typed config secret** (`@config`), checks expiry, and attaches the decoded principal to the request. It maps verification failures to a typed `UnauthorizedError` (`errors.auth.invalid_token` / `errors.auth.token_expired`).
- **Never read the JWT secret from `process.env`** outside `config/` and **never verify by hand** in a service. Verification is centralized in the guard (rule 27).
- **Token lifetimes come from config only.** Keep access tokens short (15–30 min) and refresh tokens bounded. The refresh secret is **separate** from the access secret — never sign refresh tokens with the access secret.
- **Secret strength:** validate the signing secret at startup (≥ 32 bytes of entropy) via the env validation schema; fail fast on a weak/missing secret (rule 29). Rotation invalidates live tokens — document it as a behavior change.
- **Refresh rotation is single-use and concurrency-safe.** On refresh, revoke the old session and issue a new pair; honor a short grace window so multi-tab/near-simultaneous refreshes don't revoke each other.

```ts
// DON'T — verify by hand, read the secret from process.env, trust the body for identity
@Post()
async create(@Body() body: CreateOrderDto): Promise<OrderResponseDto> {
  const decoded = jwt.verify(body.token, process.env.JWT_SECRET); // ❌ rules 27, 33
  return this.service.create(body.ownerId, body); // ❌ owner from the client body
}

// DO — global guard verified the token; identity comes from the principal
@Post()
@RequirePermissions(Permission.OrderCreate)
async create(
  @CurrentUser() actor: AuthenticatedUser,
  @Body() dto: CreateOrderDto,
): Promise<OrderResponseDto> {
  return this.createOrderUseCase.execute(actor, dto); // one delegation (rule 18)
}
```

> `@CurrentUser()` and `@Public()` are custom param/route decorators (`core/decorators/`). The `AuthenticatedUser` shape lives in `@shared/types` — never declare it inline (rules 10–11).

## 2. Authorization (RBAC) — permissions from a central catalog

A **permissions guard** (`core/guards/permissions.guard.ts`) reads the metadata set by **`@RequirePermissions(...)`** and checks the actor's effective permissions. Authentication proves *who*; authorization proves *allowed to*.

- **Resolve effective permissions server-side, not from the JWT.** The token may carry a role slug; the guard derives the permission set fresh per request (cache-backed, invalidated on role/permission change) so a grant change applies on the next request without re-issuing the token. If resolution can't run, the guard **rejects** — it never falls back to a stale map.
- **The permission catalog is the single source of truth** — a frozen enum/`as const` map in `shared/` (e.g. `@shared/constants/permissions`). Categories follow `<resource>:<action>` (`order:create`, `order:read`, `order:read:own`, `invoice:approve`, `admin:access`). Never type the raw string at a call site.
- **AND-semantics** when a route needs multiple grants: `@RequirePermissions(Permission.AdminAccess, Permission.OrderManage)` with `requireAll: true`. Default is ANY-of.
- **Least privilege by default.** New roles get the narrowest set that satisfies the use case. Prefer the **partial-relax** pattern — add narrow `:read` / `:read:own` permissions rather than one coarse grant — so admins can remove a single capability in the role→permission matrix without re-engineering the gate.

```ts
// DON'T — raw permission literal; role check hand-rolled in the controller
@Get(':id')
async get(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
  if (actor.role !== 'admin') throw new ForbiddenException(); // ❌ rules 8, 17, 34
  return this.service.findById(id);
}

// DO — declarative permission from the catalog; guard enforces it
@Get(':id')
@RequirePermissions(Permission.OrderRead)
async getById(
  @CurrentUser() actor: AuthenticatedUser,
  @Param('id') id: string,
): Promise<OrderResponseDto> {
  return this.orderService.getOwnedById(actor, id); // ownership inside (see §3)
}
```

> Define `@RequirePermissions` once in `core/decorators/`; it stamps `SetMetadata` with values from the catalog. See [/skills/add-guard-and-permission.md](../skills/add-guard-and-permission.md) and [/skills/create-error.md](../skills/create-error.md).

## 3. Ownership & tenant isolation — IDOR / cross-tenant prevention (rule 35)

A passing auth guard + permissions guard means the actor *may* touch *some* resource of this type — **not this specific one**. Every endpoint that takes a resource id by parameter **must** verify ownership/tenant scope. This is defense-in-depth: the guard authorizes the **action**, the application layer authorizes the **instance**.

- **Never authorize from a client-supplied id.** Load the resource, then compare its **server-derived** owner/tenant field against the actor's id/tenant from the verified token.
- **Scope multi-tenant reads in the query, never in memory.** Pass the tenant id into the `WHERE` clause; never fetch unbounded and filter afterward (an unbounded fetch leaks counts/timing and burns resources — see [09-performance-and-scalability.md](./09-performance-and-scalability.md)).
- **A privileged "view any" path** (e.g. admin compliance) is an explicit, separate, permission-gated branch — never a silent bypass of the ownership check.
- Centralize the rule in a reusable ownership policy (`domain/` or a shared guard) so every owned entity enforces it the same way.

```ts
// DON'T — load by id with no tenant/owner check (classic IDOR / cross-tenant read)
async getById(actor: AuthenticatedUser, id: string): Promise<Order> {
  return this.repo.findById(id); // ❌ any authorized user reads any tenant's order
}

// DO — scope the query to the actor's tenant; deny on miss with a messageKey
async getOwnedById(actor: AuthenticatedUser, id: string): Promise<Order> {
  const order = await this.repo.findByIdForTenant(id, actor.tenantId);
  if (order === null) throw new NotFoundError('errors.order.not_found'); // not "forbidden" — don't confirm existence
  return order;
}
```

> Return **not-found** (not "forbidden") for a resource outside the actor's scope, so the API never confirms that an id exists in another tenant. See [/skills/security-review.md](../skills/security-review.md).

## 4. Mass-assignment prevention — DTO whitelist

The global `ValidationPipe` runs with **`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`**. Unknown properties are stripped (or rejected), so a client can't smuggle `role`, `tenantId`, `ownerId`, `isAdmin`, or `status` into a create/update.

- **Privileged fields never come from the body.** Owner, tenant, actor, and elevated status are set server-side from the verified principal or by an authorized state transition — not from the DTO.
- **Update DTOs expose only client-editable fields.** Derive partial-update shapes with `PartialType` over a base DTO; never accept a raw entity.
- Validation rules live **in the DTO**, not the service (rule 25). See [05-dto-and-validation.md](./05-dto-and-validation.md) and [/skills/create-dto-validation.md](../skills/create-dto-validation.md).

```ts
// DON'T — accept the whole entity; client controls owner/role/status
async update(id: string, body: Record<string, unknown>): Promise<Order> {
  return this.repo.update(id, body); // ❌ mass assignment: body.tenantId, body.status, body.ownerId
}

// DO — whitelisted DTO; privileged transition resolved server-side
async update(actor: AuthenticatedUser, id: string, dto: UpdateOrderDto): Promise<Order> {
  const order = await this.getOwnedById(actor, id);
  return this.repo.update(order.id, { title: dto.title, note: dto.note });
}
```

## 5. Secret handling & no leakage (rule 36)

- **Secrets live in typed config only** (`@config`, validated at startup). Never hardcode, commit, or read `process.env` outside `config/`/`bootstrap/` (rule 27). New secrets update the env schema, the example env file, and docs in the same change.
- **Never log or return secrets/PII.** The logger adapter redacts a fixed field set (`authorization`, `password`, `token`, `refreshToken`, `accessToken`, `secret`, `apiKey`, and similar) before write. Use `@core/logger`, never `console.*` (rule 28). See [14-observability-and-logging.md](./14-observability-and-logging.md).
- **The global exception filter is the only place that shapes error bodies.** It logs full detail server-side and returns a sanitized `{ messageKey }` (+ safe metadata) — never stacks, SQL, constraint internals, vendor messages, or secrets. Map persistence errors (e.g. unique-constraint) to a stable messageKey; never surface raw driver output. See [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md).
- **Timing-safe comparison** for any secret/OTP/token/HMAC: length-check first, then `crypto.timingSafeEqual`. **Secure randomness** (`node:crypto` `randomBytes`/`randomUUID`) for tokens, OTPs, ids, and generated filenames — never `Math.random()`.
- **Hash credentials with a memory-hard / strong adaptive KDF** (argon2id or bcrypt with a high cost factor from config) — never store or compare plaintext, never compare hashes with `===`. Invalidate sessions on password change/reset.

```ts
// DON'T — timing oracle on a secret compare
if (storedToken === providedToken) grant(); // ❌

// DO — constant-time compare, length-guarded
import { timingSafeEqual } from 'node:crypto';
const stored = Buffer.from(storedToken);
const given = Buffer.from(providedToken);
if (stored.length !== given.length || !timingSafeEqual(stored, given)) {
  throw new UnauthorizedError('errors.auth.invalid_token');
}
```

## 6. Rate limiting & brute-force protection

Rate limiting is configured via **`@nestjs/throttler`** — a global default plus tighter named throttlers on sensitive routes. Limits come from typed config, not magic numbers.

| Scope | Window / max (illustrative) | Key | Apply to |
| --- | --- | --- | --- |
| Global default | per-config | client IP | every route (skip `/health`) |
| Credential / OTP / reset | tight, e.g. 15 min / 10 | `ip + identifier` | login, OTP, register, password reset |
| Token refresh | lenient, IP-keyed | client IP | refresh endpoints (no email/phone in payload) |
| Public reads / search / expensive | moderate | client IP | unauthenticated reads, heavy queries |

- **Throttle every credential/OTP/reset route.** Pair rate limiting with **account lockout** (max attempts + lockout duration, both from config) for brute-force defense.
- **Do not key refresh on `ip + identifier`** — refresh carries no email/phone, so the key collapses and 429s shared-IP/multi-tab users. Use a separate IP-keyed throttler.
- **`@SkipThrottle()`** only on long-lived streaming endpoints (SSE) where per-request counting is wrong; document why.
- Set **`trust proxy`** correctly at bootstrap so `req.ip` is the real client behind a proxy/load balancer, or rate-limit keys are useless.

## 7. Security headers (helmet) & CORS

Apply **helmet** at bootstrap with an **explicit** policy — never `helmet()` with raw defaults — and read CORS from typed config.

- **CSP** restrictive: `default-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`, `form-action 'self'`. **HSTS** with a long `max-age`, `includeSubDomains`, `preload`. `frameguard: deny`, `referrer-policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
- **CORS is an explicit allowlist** from config — **never `origin: '*'` in production**, especially with `credentials: true` (a wildcard origin is then both invalid and dangerous). Keep the allowlist tight per environment.
- **Bound request size** (small JSON body limit; large binaries go through a streaming upload path with its own size limit) to blunt DoS.

## 8. Input safety beyond the DTO

DTO validation is the first gate; these sinks need explicit handling:

- **Injection:** repositories use parameterized/ORM queries exclusively — no string-interpolated queries, no raw operator objects from user input. See [08-database-and-injection-safety.md](./08-database-and-injection-safety.md).
- **SSRF:** when fetching a user-derived URL (webhooks, imports), whitelist scheme/host, reject internal/link-local/loopback ranges, disable redirect-following to internal addresses, and wrap the call behind an adapter (rule 32) — never fetch a raw user URL inline.
- **Webhooks:** verify the provider HMAC over the **raw** body with `timingSafeEqual` before processing; reject unsigned/invalid with 401 + messageKey; rate-limit the endpoint.
- **Uploads:** fail-closed pipeline — extension/MIME allowlist → magic-byte check (real type matches declared) → malware scan via an adapter; sanitize filenames (strip path separators, null bytes, control/RTL chars); store under a generated key, never the raw client filename. See [/skills/add-library-adapter.md](../skills/add-library-adapter.md).
- **Output sinks:** escape user-controlled text before it enters any HTML sink (emails, message bodies, generated documents) — JSON responses are not HTML, but those sinks are.

## 9. Audit logging for sensitive actions

Emit an audit event for privileged/state-changing actions (role/permission changes, approvals, deletes, money movement, impersonation, login/logout).

- Audit writes are **non-blocking and fail-safe** — a failed audit insert is logged and swallowed; never `await`-gate the request on it, never let it throw into the request path (rule 38).
- Capture actor, action, entity, IP, user agent, endpoint, and before/after values for forensics. Use **enum values** for actor/action/entity types — no raw strings (rules 8/9).
- Log **all 403/authorization failures** so repeated forbidden access is detectable. See [/skills/observability-review.md](../skills/observability-review.md) and [/memory/security-decisions.md](../memory/security-decisions.md).

## 10. Canonical protected-route composition

```ts
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard) // module-wide: authn then authz
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id')
  @RequirePermissions(Permission.OrderRead) // authorization (catalog)
  getById(
    @CurrentUser() actor: AuthenticatedUser, // identity from the verified token
    @Param('id', ParseUuidPipe) id: string, // validated transport input
  ): Promise<OrderResponseDto> {
    return this.orderService.getOwnedById(actor, id); // ownership/tenant inside (§3)
  }
}
```

The chain — **authn guard → permissions guard → ownership check → bounded query** — is the lifecycle in [/context/architecture-map.md](../context/architecture-map.md). Skipping any link is a security defect, not a style nit.

---

## Quality gates (must be green)

```bash
npm run lint          # eslint (security plugin + architecture plugin) — 0 errors / 0 warnings
npm run typecheck     # tsgo --noEmit (never plain tsc)
npm run test          # vitest
npm run test:coverage # 95% floor; security-critical paths near 100%
npm run build         # nest build
```

Never bypass Husky hooks with `--no-verify`. A green build is not proof of security — prove the deny paths with tests.

---

## Security checklist (per change)

- [ ] Every new route is protected by the auth guard, or explicitly `@Public()` with a reason
- [ ] Every protected route declares `@RequirePermissions(...)` from the central catalog (no raw permission literals)
- [ ] Every id-by-parameter endpoint verifies ownership/tenant scope; out-of-scope ⇒ not-found, not "forbidden"
- [ ] Identity (actor/tenant/owner) comes from `@CurrentUser()`, never the body/query
- [ ] DTO whitelist on (`whitelist` + `forbidNonWhitelisted`); privileged fields set server-side (no mass assignment)
- [ ] Secrets only in typed config; never logged or returned; redaction covers new secret fields
- [ ] Errors are typed `AppError` + `messageKey`; the filter returns sanitized bodies (no stacks/SQL/secrets)
- [ ] Secret/OTP/HMAC compares are timing-safe; randomness from `node:crypto`; credentials hashed with a strong KDF
- [ ] Sensitive routes are rate-limited (refresh keyed separately); brute-force lockout where credentials are checked
- [ ] Helmet set explicitly; CORS is an environment allowlist (never `*` in prod); request size bounded
- [ ] SSRF/webhook/upload sinks handled (host allowlist, HMAC verify, fail-closed upload pipeline, filename sanitize)
- [ ] Privileged/state-changing actions emit a fail-safe audit event; 403s are logged
- [ ] Tests cover the deny paths (unauthenticated, unauthorized, cross-tenant) and pass; docs updated

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [05-dto-and-validation.md](./05-dto-and-validation.md) · [08-database-and-injection-safety.md](./08-database-and-injection-safety.md) · [14-observability-and-logging.md](./14-observability-and-logging.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [/skills/add-guard-and-permission.md](../skills/add-guard-and-permission.md) · [/skills/security-review.md](../skills/security-review.md) · [/memory/security-decisions.md](../memory/security-decisions.md)
