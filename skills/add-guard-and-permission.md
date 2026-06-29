# Skill — Add a Guard & Permission (catalog → roles → protected route)

> Add a permission to the central catalog, wire it to roles, and protect a route with the auth guard → permissions guard → ownership/tenant check. Implements the security canon in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) (rules 33–37) and [07-security-authn-authz.md](../rules/07-security-authn-authz.md).

## Rules this skill enforces

- **Authn ≠ authz ≠ ownership.** Every protected route chains all three, in order (rules 33–35).
- **Permission strings come from the central catalog** — never a raw `'order:create'` literal at a call site (rules 8, 34).
- **Identity comes from the verified token** via `@CurrentUser()`, never the request body/query (rule 33).
- **Owned resources verify scope in the query** and return not-found (never "forbidden") for out-of-scope ids (rule 35).
- **Adding a permission constant grants nothing to non-admin roles** — you must wire it into a role set explicitly (least privilege).
- **Tests first; deny paths proven** (unauthenticated, unauthorized, cross-tenant) (rule 42).

## Inspect first

- `src/shared/constants/permissions.ts` — the frozen `Permission` catalog (single source of truth).
- `src/shared/constants/roles.ts` — the role → permission matrix (which role gets which grants).
- `src/core/decorators/require-permissions.decorator.ts` — `@RequirePermissions(...)` metadata stamp.
- `src/core/guards/` — `jwt-auth.guard.ts` (authn), `permissions.guard.ts` (authz).
- The target `src/modules/<feature>/api/<feature>.controller.ts` and its service/use-case.

---

## Steps

### 0. Tests FIRST

Write the failing deny/allow specs before touching production code (rule 42). At minimum: granted role → 200, role without the grant → 403, no token → 401, and another tenant's id → 404. See [write-e2e-tests.md](./write-e2e-tests.md) and [security-review.md](./security-review.md).

```ts
// test/<feature>.e2e-spec.ts (illustrative)
it('denies a role lacking the grant', () =>
  request(app.getHttpServer())
    .get(`/articles/${id}`)
    .set('Authorization', bearer(viewerWithoutGrant))
    .expect(HttpStatus.FORBIDDEN));

it("returns 404 for another tenant's resource", () =>
  request(app.getHttpServer())
    .get(`/articles/${otherTenantArticleId}`)
    .set('Authorization', bearer(actor))
    .expect(HttpStatus.NOT_FOUND));
```

### 1. Add the permission to the central catalog

One entry, `<resource>:<action>` naming consistent with siblings. Prefer a narrow grant (`:read:own`) over a coarse one so the matrix stays adjustable (rule 8, no magic strings).

```ts
// src/shared/constants/permissions.ts
export const Permission = {
  ArticleRead: 'article:read',
  ArticleReadOwn: 'article:read:own',
  ArticleManage: 'article:manage', // ← add it here
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
export const PERMISSION_VALUES: readonly Permission[] = Object.values(Permission);
```

### 2. Wire it into the role → permission matrix

A new catalog entry grants **nothing** until a role references it. Admin may inherit `PERMISSION_VALUES`; every other role needs explicit, least-privilege wiring.

```ts
// src/shared/constants/roles.ts
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.Admin]: PERMISSION_VALUES, // inherits all
  [Role.Editor]: [Permission.ArticleRead, Permission.ArticleManage], // ← wired
  [Role.Viewer]: [Permission.ArticleRead],
} as const;
```

### 3. Declare the permission on the route (never a literal)

Reference the catalog member through `@RequirePermissions`. Keep the controller thin — one delegation per method (rule 18); the guards run from the module-level `@UseGuards` (authn then authz).

```ts
// src/modules/article/api/article.controller.ts
@Controller('articles')
@UseGuards(JwtAuthGuard, PermissionsGuard) // authn → authz, module-wide
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get(':id')
  @RequirePermissions(Permission.ArticleRead) // authorization from the catalog
  getById(
    @CurrentUser() actor: AuthenticatedUser, // identity from the verified token
    @Param('id', ParseUuidPipe) id: string, // validated transport input
  ): Promise<ArticleResponseDto> {
    return this.articleService.getOwnedById(actor, id); // ownership inside (step 4)
  }
}
```

For AND-semantics, pass multiple grants: `@RequirePermissions(Permission.AdminAccess, Permission.ArticleManage)` with `requireAll: true`.

### 4. Add the ownership / tenant check for id-by-parameter routes

Guards prove the actor may touch *some* article — not *this* one. Scope the read to the actor's tenant in the `WHERE` clause and return not-found on a miss, so the API never confirms an id exists in another tenant (rule 35). Keep the service ≤20 lines/method.

```ts
// src/modules/article/application/article.service.ts
async getOwnedById(actor: AuthenticatedUser, id: string): Promise<Article> {
  const article = await this.repo.findByIdForTenant(id, actor.tenantId);
  if (article === null) {
    throw new NotFoundError('errors.article.not_found'); // not "forbidden"
  }
  return article;
}
```

A privileged "view any" path is a **separate, permission-gated branch** (e.g. `@RequirePermissions(Permission.AdminAccess)`), never a silent bypass.

### 5. Cover the error key and audit

- Ensure the deny error is a typed `AppError` with `errors.<feature>.<key>`; register the key for each supported locale ([add-i18n-message-key.md](./add-i18n-message-key.md), [create-error.md](./create-error.md)).
- Privileged/state-changing routes emit a fail-safe audit event; log 403s for repeated-forbidden detection ([observability-review.md](./observability-review.md)).

---

## Quality gates (must be green)

```bash
npm run lint          # eslint (architecture + security plugins) — 0 errors / 0 warnings
npm run typecheck     # tsgo --noEmit (never plain tsc)
npm run test          # vitest
npm run test:coverage # 95% floor; auth/ownership paths near 100%
npm run build         # nest build
```

Never bypass Husky hooks with `--no-verify`. A green build is not proof of security — the deny tests are.

## Pitfalls

- **Catalog entry without role wiring** — non-admin roles silently get nothing; only admins (who inherit all) work, masking the gap. Wire step 2.
- **Raw permission literal** at the call site — fails lint (no magic strings) and drifts from the catalog. Always reference `Permission.*`.
- **Trusting a client-supplied owner/tenant id** — read identity from `@CurrentUser()`; treat any owner/tenant field in body/query as untrusted (IDOR risk).
- **`@RequirePermissions` without the guards** — the decorator only stamps metadata; without `JwtAuthGuard` + `PermissionsGuard` it does nothing. Confirm the `@UseGuards` chain.
- **Returning "forbidden" for an out-of-scope id** — confirms existence across tenants. Return not-found.
- **Resolving permissions from the JWT claims** — a stale token keeps a revoked grant. The guard derives the effective set server-side per request.
- **New locale key missing** — the deny path throws an unmapped `messageKey`. Add it for every supported locale.

## Related

[07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md) · [create-error.md](./create-error.md) · [add-i18n-message-key.md](./add-i18n-message-key.md) · [write-e2e-tests.md](./write-e2e-tests.md) · [security-review.md](./security-review.md) · [/memory/security-decisions.md](../memory/security-decisions.md)
