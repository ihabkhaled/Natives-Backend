# Skill: SQL injection review

> Audit every query path in a change for injection: prove each runtime value is a bound parameter, each identifier comes from a whitelist, and add malicious-payload tests. Implements the persistence safety canon in [/context/architecture-map.md](../context/architecture-map.md) and [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md).

The rule is binary: **no runtime value is ever concatenated into a query string.** Values bind as parameters; identifiers (columns, sort keys, table names, `ASC|DESC`) resolve through an allowlist. Anything else is a BLOCKER. This applies to every engine — TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples; the audit is the same because injection lives at the query boundary, which is confined to `infrastructure/<feature>.repository.ts` and adapters.

---

## Rules this skill enforces

- **No raw query string interpolation.** Every runtime value is a bound parameter; never splice input into the query text. ([rule 31](../rules/00-non-negotiable-rules.md), [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md))
- **Identifiers come from an allowlist.** Column/table/sort/direction cannot be parameterized — resolve them through a constant map or enum, never client text. ([06-types-enums-constants.md](../rules/06-types-enums-constants.md))
- **Bounded + paginated.** `limit` is clamped to a hard max of **100** and offsets are numeric; pagination is validated at the DTO and clamped in the repository. ([rule 37](../rules/09-performance-and-scalability.md))
- **Queries live only in persistence/adapters.** No raw query API in controllers/services/use-cases — ESLint blocks vendor imports outside their layer. ([01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md))
- **Defense in depth, not instead.** DTO validation upstream is required, but it is never a substitute for parameterization. ([05-dto-and-validation.md](../rules/05-dto-and-validation.md))

---

## Step 1 — Scope the diff and find every query path

Audit anything that builds a query from a variable. Use the Grep tool (results link in the UI), scoped to the persistence/adapter layers where queries are allowed to exist.

```bash
git diff origin/main...HEAD -- 'src/**/infrastructure/*.repository.ts' 'src/**/adapters/*.adapter.ts'
```

Grep patterns to run across the diff (highest risk first):

| Pattern | What it catches |
| --- | --- |
| `\.query\(` / `\$queryRawUnsafe\(` / `\$executeRawUnsafe\(` | Raw SQL execution — top risk |
| `\$\{` near a query call | A value interpolated into query text |
| `createQueryBuilder[\s\S]{0,400}\$\{` | Interpolated `where`/`andWhere` clauses |
| `Raw\(` / `\.$expr` / `\$where` | ORM raw escape hatches (the usual culprit) |
| `orderBy` / `ORDER BY` / `LIMIT` near `query`/`params` | Identifiers built from client input |

## Step 2 — Classify values: bind, never concatenate

Every runtime **value** must travel as a bound parameter. The find/where-object API binds by construction — prefer it.

```ts
// Do — parameterized find options (no string building at all)
async findActiveByEmail(email: string): Promise<Account | null> {
  return this.accounts.findOne({ where: { email, status: AccountStatus.ACTIVE } });
}

// Do — positional bind for raw SQL
async deleteSessions(userId: string): Promise<void> {
  await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}
```

```ts
// Don't — value spliced into the query text (BLOCKER, rule 31)
async findByEmail(email: string): Promise<Account | null> {
  return this.db.query(`SELECT * FROM accounts WHERE email = '${email}'`); // ❌ injection
}
```

## Step 3 — Query builder: named params, never template values

When the find API can't express the query, drop to the query builder. Every value is a `:name` placeholder passed in the params object.

```ts
// Do — bound values; the where fragment is a static string
async search(tenantId: string, term: string): Promise<Order[]> {
  return this.orders
    .createQueryBuilder('o')
    .where('o.tenant_id = :tenantId', { tenantId })           // ✅ bound
    .andWhere('o.title ILIKE :term', { term: `%${term}%` })    // ✅ bound (wildcards on the value)
    .andWhere('o.deleted_at IS NULL')
    .getMany();
}
```

```ts
// Don't — user value inlined into the where string (BLOCKER)
.where(`o.status = '${query.status}'`); // ❌ never interpolate, even from a DTO field
```

## Step 4 — Identifiers: whitelist, never bind, never splice

You **cannot** parameterize a column, table, or sort direction — placeholders only bind values. So validate identifiers against a constant allowlist or enum and let the compiler refuse anything else. The allowlist lives in `model/<feature>.constants.ts` (no inline maps — [rule 13](../rules/00-non-negotiable-rules.md)).

```ts
// model/order.constants.ts
export const ORDER_SORT_COLUMNS = {
  createdAt: 'o.created_at',
  total: 'o.total',
} as const;
```

```ts
// Do — sort key resolved through the whitelist; direction from an enum
import { ORDER_SORT_COLUMNS } from '../model/order.constants';
import { SortDirection } from '@shared/enums';

async list(
  tenantId: string,
  sortKey: keyof typeof ORDER_SORT_COLUMNS,
  direction: SortDirection,
): Promise<Order[]> {
  return this.orders
    .createQueryBuilder('o')
    .where('o.tenant_id = :tenantId', { tenantId })
    .orderBy(ORDER_SORT_COLUMNS[sortKey], direction) // ✅ identifier + direction both whitelisted
    .take(MAX_LIST_LIMIT)
    .getMany();
}
```

```ts
// Don't — client identifier and direction spliced into SQL (BLOCKER)
.orderBy(`o.${query.sort}`, query.order); // ❌ splice + no allowlist
```

## Step 5 — ORM raw escape hatches: only with a params map

`Raw()` and equivalent operators concatenate by default. Permit them **only** with a bound placeholder; flag any inline fragment built from input.

```ts
import { Raw } from 'typeorm';

// Do — placeholder + params map
where: { tags: Raw(alias => `${alias} @> :needle`, { needle: JSON.stringify([tag]) }) };

// Don't — user value concatenated into the raw fragment (BLOCKER)
where: { name: Raw(() => `name = '${userInput}'`) }; // ❌
```

For document/NoSQL stores the same rule holds: never pass a raw client object as a query operator (operator injection). Whitelist the fields and operators you accept; bind the value.

## Step 6 — Confirm bounds and trust boundary

For each audited list query, confirm the limit is clamped and the offset is numeric — defense in depth against unbounded scans and integer abuse.

```ts
const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIST_LIMIT); // hard cap 100
const skip = (Math.max(options.page ?? DEFAULT_PAGE, 1) - 1) * limit;
```

Then trace each interpolated/dynamic segment back to its origin. If any reaches the query from a DTO field, route param, query string, or header and is concatenated → **BLOCKER**. Verify the value also passed the upstream `ValidationPipe` DTO, but treat that as a second layer, not the fix.

---

## Tests FIRST

Write or extend the failing tests **before** the fix; keep both the failing evidence and the green retest. Every audited path gets a malicious-payload test proving metacharacters are treated as a literal value, and every dynamic identifier gets a test proving an out-of-allowlist value falls back to the default. Run them against a real engine (integration) — see [write-integration-tests.md](./write-integration-tests.md) — plus a fast unit test for the allowlist fallback ([write-unit-tests.md](./write-unit-tests.md)).

```ts
it('treats SQL metacharacters as a literal value, not as SQL', async () => {
  const evil = `'; DROP TABLE accounts; --`;

  const res = await request(app.getHttpServer()).get(
    `/accounts/${encodeURIComponent(evil)}`,
  );

  expect([200, 404]).toContain(res.status); // a normal lookup, never a 500 from broken SQL
  const intact = await dataSource.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts'`,
  );
  expect(intact).toHaveLength(1);
});

it('falls back to the default sort for an out-of-allowlist column', async () => {
  const res = await request(app.getHttpServer()).get(
    '/orders?sort=password;DROP TABLE accounts&order=ASC',
  );

  expect(res.status).toBe(200); // identifier rejected before it reaches SQL
});
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

All green, no warnings (including the `security/*` rules). Coverage floor 95% on touched paths; injection-prone queries near 100%. Never bypass Husky hooks with `--no-verify`.

## Pitfalls

- Interpolating any value into query text — bind it (`$n` / `:name` / `where: {}`). Even a "trusted" enum-typed DTO field belongs in a bound param.
- Trusting DTO validation alone — it narrows shape, it does not prevent injection. Parameterize regardless.
- Feeding a client `sort`/`order`/column into `orderBy`/`select` — always resolve through an allowlist constant or enum.
- A raw escape hatch (`Raw`, `$queryRawUnsafe`, `$where`) with an inline fragment — only ever with a params map.
- Operator injection in document stores — never spread a raw client object into a query filter.
- A raw query API leaking into a service/use-case/controller — queries live only in `infrastructure/`/adapters; ESLint blocks the import elsewhere.
- An unbounded or un-clamped list — cap `limit` at 100 and keep the offset numeric.
- Logging the raw query with values inlined — leaks PII/secrets and the attack payload; log parameters separately and redacted ([14-observability-and-logging.md](../rules/14-observability-and-logging.md)).
- Finding a brand-new unsafe pattern and not recording it — log it in [/memory/known-pitfalls.md](../memory/known-pitfalls.md).

## Related

[security-review.md](./security-review.md) · [create-repository.md](./create-repository.md) · [performance-review.md](./performance-review.md) · [write-integration-tests.md](./write-integration-tests.md) · [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [/memory/database-decisions.md](../memory/database-decisions.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
