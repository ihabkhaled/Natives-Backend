# 08 — Database & Injection Safety

> How to read and write the database from a NestJS backend without ever opening an injection hole. Implements the data-access canon in [`/context/architecture-map.md`](../context/architecture-map.md) and rules 31, 36, 37 in [00-non-negotiable-rules.md](./00-non-negotiable-rules.md). ORM-agnostic: TypeORM / Prisma / Mongoose / Sequelize are interchangeable **examples** — the safety rules are the constant, the client is the variable.

**Rules enforced here:** no raw query string interpolation; values bind as parameters; every dynamic identifier (sort/filter/column) is allowlisted; mass-assignment is blocked at the DTO; transactions live in the use case; migrations are static, reviewed code; errors surface as a `messageKey`, never raw driver output.

---

## 0. The one rule

**User input enters a query only as a bound parameter — never as query text, never as an identifier.**

- **Values** (the right-hand side of a filter) → parameters / the ORM's structured `where`.
- **Identifiers** (column, table, sort key, direction) → validated against a static allowlist before they touch the query.

Everything below is a corollary.

---

## 1. Values must be parameters

Bind every value. Concatenation or template literals carrying input into a query string are forbidden (rule 31), and `architecture/no-restricted-layer-imports` keeps the ORM client inside `infrastructure/*.repository.ts` so this discipline has exactly one home.

```ts
// DON'T — string interpolation: classic injection (' OR 1=1 --)
qb.where(`account.email = '${filter.email}'`); // ❌ rule 31
const rows = await qb.where('a.title LIKE %' + query.q + '%').getMany(); // ❌
```

```ts
// DO — bound parameter, two-arg form (query-builder example)
qb.andWhere('account.email = :email', { email: filter.email });

// DO — structured where object (the client binds for you)
return this.repo.findOne({ where: { id, deletedAt: null } });
```

| Concern                 | Safe form (illustrative)                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Query builder predicate | `qb.andWhere('a.status = :status', { status })` — always two args                                                                   |
| `IN (...)` list         | `qb.andWhere('a.id IN (:...ids)', { ids })` — the client expands & binds each element                                               |
| Range / null / like     | structured operators (`In`, `IsNull`, `LessThan`, `Between`, `ILike` / Prisma `in`, `lte`, `contains`) — not hand-written fragments |
| Raw escape hatch        | `manager.query('... WHERE x = $1', [value])` with a parameter array — **never** `'... ' + value`                                    |

> If you genuinely need a raw query, it still uses placeholders + a bound argument array. A raw query that concatenates input is a review blocker, full stop.

## 2. Identifiers must be allowlisted

Parameters protect **values**, not **identifiers**. A column, table, or sort key from the request must be checked against a static allowlist before it is interpolated. Keep the allowlist beside the repository's other constants (`model/<feature>.constants.ts`), never inline (rules 8, 13).

```ts
// shared/utils — one safe sort helper every list query reuses
export function applySorting<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  sort: string | undefined,
  order: SortDirection,
  allowedFields: readonly string[],
  defaultField: string,
): void {
  const field = sort && allowedFields.includes(sort) ? sort : defaultField; // ← allowlist gate
  qb.orderBy(`${alias}.${field}`, order);
}
```

```ts
// DO — sort field validated against an explicit allowlist (constant)
applySorting(
  qb,
  'account',
  query.sort,
  query.order,
  ACCOUNT_SORT_FIELDS,
  'createdAt',
);

// DON'T — interpolate a client-supplied sort column straight into ORDER BY
qb.orderBy(`account.${query.sort}`, 'DESC'); // ❌ identifier injection
```

- **Sort direction** is an enum (`SortDirection.ASC | DESC`), validated in the DTO — never pass a raw `order` string into `orderBy`.
- **Table / entity names are static**, fixed at compile time. They never come from input.
- Do the same for any feature that needs structured ordering: build a typed order object from the allowlist rather than passing the raw key through.

## 3. Filters are explicit, never reflective

Each filterable column is a deliberate, named, parameterized branch. There is no "apply whatever the client sends" loop — that re-introduces both injection and mass-assignment.

```ts
// DO — explicit, per-column, parameterized, added only when present
if (filter.status)
  qb.andWhere('account.status = :status', { status: filter.status });
if (filter.ownerId)
  qb.andWhere('account.ownerId = :ownerId', { ownerId: filter.ownerId });
if (filter.from)
  qb.andWhere('account.createdAt >= :from', { from: filter.from });

// DON'T — generic "filter by any body key"
for (const [col, val] of Object.entries(query))
  qb.andWhere(`a.${col} = :v`, { v: val }); // ❌
```

- **Enum filters** (status / type / role) are validated against the enum in the DTO (`@IsEnum` / Zod native-enum / the `*_VALUES` tuple), then bound as parameters and compared to enum members — never raw literals (rules 8, 9; see [06-types-enums-constants.md](./06-types-enums-constants.md)).
- A filter the allowlist does not recognize is dropped or rejected — it never reaches the query builder.

## 4. Escape `LIKE` / `ILIKE` wildcards

For substring search the user string is a **value** (so bind it) — but `%` and `_` inside it are wildcards that change the query's meaning and can trigger pathological scans. Escape them, then bind.

```ts
// DON'T — unescaped and concatenated
qb.andWhere(`a.title ILIKE '%${q}%'`); // ❌ injection + wildcard abuse

// DO — bind the value AND escape LIKE metacharacters
const escaped = q
  .replaceAll('\\', '\\\\')
  .replaceAll('%', '\\%')
  .replaceAll('_', '\\_');
qb.andWhere("a.title ILIKE :q ESCAPE '\\'", { q: `%${escaped}%` });
```

Put the escape logic in one shared helper (`@shared/utils`) so every search endpoint uses identical rules. Do not reinvent it per repository.

## 5. NoSQL / document-store injection

Operator-shaped input is the document-store analogue of SQL injection. A query object built straight from request data lets a client smuggle `$ne`, `$gt`, `$where`, or `$regex`.

```ts
// DON'T — query object built from raw input → ?status[$ne]=x bypasses the filter
return this.model.findOne({ status: body.status }); // ❌ when body.status is { $ne: '...' }

// DO — coerce to a primitive at the DTO boundary, then query a typed field
return this.model.findOne({ status: dto.status }); // dto.status: AccountStatus (validated string)
```

- Validate to primitives/enums in the DTO (global `ValidationPipe` with `whitelist: true`, `transform: true`); reject objects where a string/number is expected.
- Never enable server-side JavaScript evaluation (`$where`, `mapReduce` with strings) on untrusted input.
- The repository/adapter receives already-validated, typed fields — it does not re-parse the request.

## 6. Block mass assignment

Persisting a raw request object lets a client set fields it should never control (role, ownerId, balance, isVerified, timestamps).

```ts
// DON'T — spread the body into the entity
await this.repo.save({ ...body }); // ❌ client can set role/ownerId/anything

// DO — the DTO is the allowlist (whitelist:true strips unknowns); map explicitly
const entity = this.mapper.toEntity(dto, { ownerId: actor.id }); // server sets identity-derived fields
await this.repo.save(entity);
```

- `whitelist: true` strips any property without a DTO decorator; pair with `forbidNonWhitelisted: true` to reject unexpected fields outright.
- **Identity-derived and authority fields come from the verified token / service context, never the body** (rule 33; see [07-security-authn-authz.md](./07-security-authn-authz.md)). The mapper sets them; the DTO can't carry them.
- Use **distinct create vs. update DTOs**: immutable fields (id, ownerId, createdAt) simply do not appear on the update DTO.

## 7. Transactions live in the use case

Atomicity is an orchestration concern. Multi-entity / multi-step writes run inside a transaction owned by an `application/<action>.use-case.ts`; a single-entity write stays in a service. Repositories execute statements — they do not open transactions or decide boundaries (see [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).

```ts
// DO — use case owns the boundary; post-commit events fire only after success
async execute(input: TransferInput): Promise<TransferResult> {
  const result = await this.uow.runInTransaction(async (tx) => {
    const from = await this.accountRepo.debit(input.fromId, input.amount, tx);
    const to = await this.accountRepo.credit(input.toId, input.amount, tx);
    return this.mapper.toResult(from, to);
  });
  this.events.emit(ACCOUNT_TRANSFERRED, result); // after commit, fail-safe (rule 38)
  return result;
}
```

- Keep transactions **small and short**; never wrap read-only work in one, and never do remote/IO calls (email, HTTP, queue publish) inside the transaction — emit those as post-commit events.
- If the client uses manual handles (e.g. a query runner / session), **release in `finally`, always** — wrap that in the unit-of-work helper so no leak is possible.
- One transaction per business operation. Nesting "just in case" is a smell that the operation belongs in a use case, not a service.

## 8. Migrations & DDL are static, reviewed code

- Schema changes ship as ordered, version-controlled migrations — not runtime mutations. Author them; review them like application code.
- **Never enable destructive auto-sync** (`synchronize: true` or any "sync schema from models" mode). It can silently alter or drop columns. It is off in every environment.
- **Never edit an already-applied migration.** Add a new, additive, corrective migration instead.
- **Never build DDL from runtime input.** Migration SQL is authored, parameter-free, reviewed.
- Treat destructive steps (drop / type-narrowing / non-null backfill) as high-risk: pair them with a backfill + rollback plan and observability. See [add-migration-backfill.md](../skills/add-migration-backfill.md) and [migration-plan.md](../skills/migration-plan.md).
- Connection pool sizing, timeouts, and TLS are typed config (`@nestjs/config`), validated at startup (rule 27); production requires DB TLS and forbids default/blank credentials. See [17-configuration-and-environment.md](./17-configuration-and-environment.md).

## 9. Repository discipline

Repositories do **persistence only** (rules 19/20). No business policy, no transformation — return raw entities and let services/mappers shape them.

- Parameterized **and bounded**: every list method accepts and applies pagination with a hard max limit (default cap **100**). Clamp the limit in the repository so no caller can request an unbounded scan. See [09-performance-and-scalability.md](./09-performance-and-scalability.md).
- Soft-delete reads filter the deleted marker; include it in composite indexes.
- Scoping (tenant / owner) is applied where the repository is the responsible layer, and re-checked in the application layer for defense-in-depth (rule 35).
- Type the client's partial-update payloads through the client's own typed shape — do not reach for `any` to silence the compiler (rule: no `any`).

## 10. Safe error surfacing

Driver errors leak schema, SQL, table names, and constraint internals. They must never reach the client.

```ts
// DON'T — bubble the raw driver error to the caller
catch (e) { throw new BadRequestException(e.message); } // ❌ leaks SQL/constraint/table names

// DO — log full detail server-side, throw a typed AppError with a messageKey
catch (error) {
  this.logger.error('account.create failed', { error });
  if (isUniqueViolation(error)) throw new ConflictAppError('errors.account.email_taken');
  throw new PersistenceAppError('errors.account.create_failed');
}
```

- Map known constraint failures (unique / foreign-key / not-null) to **specific** typed `AppError` subclasses, each with a distinct `messageKey` (`errors.<feature>.<key>`). The global exception filter renders the sanitized body. See [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md).
- Never echo the input that triggered the error, the query, or stack traces (rule 36). Full detail goes to structured logs only (rule 28; see [14-observability-and-logging.md](./14-observability-and-logging.md)).

## 11. Prove injection is neutralized (tests)

Every new search / filter / sort / write surface ships with tests that prove the hole is closed (rule 42; write them first). Use the project test stack (Vitest + supertest); coverage floor 95%, near-100% on these paths.

| Attack input                                   | Expected behavior                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `sort=id;DROP TABLE accounts;--`               | falls back to the default field, `200`, no error, schema intact       |
| filter value `' OR '1'='1` / `%` / `_` / `\`   | treated as a literal; zero or correctly-scoped rows, no extra results |
| document query `?status[$ne]=x` / `?q[$gt]=`   | rejected by the DTO or coerced to a primitive                         |
| `limit=99999` / `-1` / `abc`                   | clamped into `[1, 100]`                                               |
| body carries `role` / `ownerId` / `isVerified` | stripped by the DTO; server value wins                                |

```ts
// Integration sketch — sort allowlist neutralizes identifier injection
import { describe, it, expect } from 'vitest';

it('ignores a non-allowlisted / malicious sort column', async () => {
  const res = await request(app.getHttpServer())
    .get('/accounts?sort=id;DROP TABLE accounts;--&order=ASC')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200); // falls back to default sort, no 500, table intact
});
```

See [11-testing-and-coverage.md](./11-testing-and-coverage.md), [sql-injection-review.md](../skills/sql-injection-review.md), and recurring traps in [/memory/known-pitfalls.md](../memory/known-pitfalls.md).

---

## Anti-patterns (reject in review)

- [ ] Template literal / `+` concatenation building any part of a `WHERE` / `ORDER BY` from input → rule 31
- [ ] `query.sort` / `query.order` reaching `orderBy` without an allowlist → identifier injection
- [ ] Generic "apply all body keys as filters / spread body into the entity" → injection + mass assignment
- [ ] Unescaped `%` / `_` in `LIKE` / `ILIKE`
- [ ] Document query built from raw input (operator smuggling: `$ne`, `$gt`, `$where`)
- [ ] Identity / authority fields (role, ownerId) read from the request body
- [ ] Auto-sync / dynamic DDL / editing an applied migration / raw `query('...' + x)`
- [ ] Transaction opened in a repository, or remote IO inside a transaction
- [ ] Raw driver error / SQL / stack trace returned to the client
- [ ] List query with no pagination and no max limit

## Checklist

- [ ] Every value is bound; no string carries input into a query
- [ ] Every dynamic identifier (column/sort/direction) is allowlisted; direction is an enum
- [ ] Filters are explicit per-column branches, not reflective loops
- [ ] `LIKE`/`ILIKE` wildcards escaped via the shared helper
- [ ] Document queries validated to primitives/enums; no operator smuggling
- [ ] DTO is the write allowlist (`whitelist: true`); identity fields set server-side
- [ ] Transactions owned by the use case, small, no remote IO inside; handles released in `finally`
- [ ] Migrations static & reviewed; auto-sync off; applied migrations never edited
- [ ] Repository persists only; lists paginated with a hard max (100)
- [ ] Driver errors mapped to typed `AppError` + `messageKey`; nothing raw leaks
- [ ] Injection/mass-assignment tests written first; `lint` / `typecheck` / `test:coverage` / `build` green
