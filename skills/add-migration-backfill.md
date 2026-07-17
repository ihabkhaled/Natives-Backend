# Skill: Add a Reversible Migration / Chunked Backfill

> Evolve the schema and transform data **safely, reversibly, and verifiably**. This implements the canon — schema changes are additive-first, every migration has a real `down()`, backfills are chunked + resumable + observable, and persisted state is verified after the fact. See [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## Rules this skill enforces

- **Reversible** — every migration ships a real `up()` and a `down()` that reverses it. ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md))
- **Additive-first** — prefer expand → migrate → contract; no destructive step without a backup + rollback note. ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md))
- **Parameterized** — every backfill binds values; zero string interpolation of data. ([08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md))
- **Bounded + chunked** — backfills run in capped, resumable batches; no full-table scan in one transaction. ([09-performance-and-scalability.md](../rules/09-performance-and-scalability.md))
- **Observable + terminal** — progress logged via the logger adapter; a backfill job has success/failure/timeout states. ([14-observability-and-logging.md](../rules/14-observability-and-logging.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md))
- **Migration logic stays behind the data layer** — runners/repositories own SQL/ORM; no vendor calls leak into services. ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md), [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md))
- **Verified** — persisted state is asserted, not assumed. ([11-testing-and-coverage.md](../rules/11-testing-and-coverage.md))

> ORM-agnostic. The examples below use a generic SQL migration runner; the same shape applies to TypeORM / Prisma / Mongoose / Sequelize — keep the vendor behind the migration runner or a repository. Identifiers like `Order` / `Account` are **illustrative placeholders** for `<feature>`.

## Inspect first

1. The migrations directory and its latest sequence file — mirror its style and pick the **next free number**.
2. The affected entity/model and repository under `src/modules/<feature>/`.
3. [migration-plan.md](./migration-plan.md) — author the expand/migrate/contract plan before touching DDL.
4. [memory/database-decisions.md](../memory/database-decisions.md) — record schema/index decisions and the migration count.

---

## Steps

### 1. Plan the shape (expand → migrate → contract)

For any breaking change, split it across releases so the running app is never broken:

| Phase        | What ships                                                                     | Reversible?                              |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------- |
| **Expand**   | Add nullable column / new table + indexes; app dual-writes                     | Yes — drop the new shape                 |
| **Migrate**  | Chunked backfill; switch reads to the new shape                                | Yes — flip reads back                    |
| **Contract** | Drop the old column **in a separate migration**, after the new shape is proven | A `DROP` is not data-reversible — say so |

### 2. Write the migration (real `up()` and `down()`)

Use idempotent DDL (`IF [NOT] EXISTS`) so a partially-applied DB re-runs cleanly. New columns are **nullable or defaulted** — never `NOT NULL` without a default on a populated table. Index every new FK / `WHERE` / `ORDER BY` column in the **same** migration.

```ts
// src/.../migrations/0042-add-order-archived-at.ts
import type { MigrationRunner } from '@core/database';

export class AddOrderArchivedAt0042 {
  public readonly name = 'AddOrderArchivedAt0042'; // must match the recorded ledger id

  public async up(runner: MigrationRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ NULL;`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_archived_at"
         ON "orders" ("archived_at") WHERE "archived_at" IS NOT NULL;`,
    );
  }

  public async down(runner: MigrationRunner): Promise<void> {
    // reverse up() in reverse order
    await runner.query(`DROP INDEX IF EXISTS "idx_orders_archived_at";`);
    await runner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "archived_at";`,
    );
  }
}
```

### 3. Keep the entity/model in sync

Add the matching field and index metadata to the entity/model so the ORM and the schema agree. Update DTOs/mappers only if the field is exposed at the HTTP boundary ([05-dto-and-validation.md](../rules/05-dto-and-validation.md)).

```ts
// src/modules/order/domain/order.entity.ts  (ORM-agnostic illustration)
@Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
@Index('idx_orders_archived_at')
public archivedAt: Date | null = null;
```

### 4. Write the backfill as a chunked, resumable runner

The backfill is **data access** — it lives behind a repository, runs in **bounded batches**, advances by a stable cursor (id / created-at), and is safe to re-run from where it stopped. Bind every value. Batch size is a named constant, never a literal.

```ts
// src/modules/order/model/order.constants.ts
export const ORDER_BACKFILL_BATCH_SIZE = 500 as const;

// src/modules/order/infrastructure/order.repository.ts
public async fetchUnarchivedBatch(afterId: string, limit: number): Promise<OrderRow[]> {
  return this.db.query<OrderRow>(
    `SELECT id FROM "orders"
       WHERE "id" > $1 AND "archived_at" IS NULL
       ORDER BY "id" ASC
       LIMIT $2`,
    [afterId, limit], // parameterized — never interpolate
  );
}

public async markArchived(ids: readonly string[], at: Date): Promise<number> {
  const result = await this.db.query(
    `UPDATE "orders" SET "archived_at" = $2 WHERE "id" = ANY($1)`,
    [ids, at],
  );
  return result.rowCount;
}
```

Orchestrate batches in a use case (multi-step, observable, terminal). Each batch is its own transaction so failure resumes from the last committed cursor — never one giant lock. Services stay ≤20 lines, so loop orchestration belongs in a **use case** ([03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)).

```ts
// src/modules/order/application/backfill-order-archived-at.use-case.ts
@Injectable()
export class BackfillOrderArchivedAtUseCase {
  private readonly log = this.logger.child(BACKFILL_LOG_PREFIX);

  constructor(
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
    private readonly logger: AppLogger,
  ) {}

  public async run(): Promise<BackfillResult> {
    let cursor = EMPTY_CURSOR;
    let processed = 0;
    for (;;) {
      const batch = await this.orders.fetchUnarchivedBatch(
        cursor,
        ORDER_BACKFILL_BATCH_SIZE,
      );
      if (batch.length === 0) break; // terminal: success
      const ids = batch.map(row => row.id);
      processed += await this.orders.markArchived(ids, this.clock.now());
      cursor = ids[ids.length - 1] ?? cursor;
      this.log.info('backfill_progress', { processed, cursor });
    }
    return { status: BackfillStatus.Completed, processed };
  }
}
```

### 5. Verify the result

A backfill is done when persisted state is **proven**, not when the loop exits. Assert the remaining count is zero (or expected) and capture it in the run report. Reconcile counts before reads are switched.

```ts
const remaining = await this.orders.countUnarchived();
this.log.info('backfill_verify', { processed, remaining });
// remaining must equal the expected residual; otherwise re-run from the cursor.
```

### 6. Wire safety into the run

- Run via the project migration/job command — never an ad-hoc one-off script, never the type-checker.
- A long backfill is a job with a **timeout** and an explicit terminal state; emit start/progress/finish logs.
- Destructive contract steps require a **backup note** and a **rollback note** in the PR.

---

## Tests FIRST

Write/adjust tests **before** the migration runs anywhere shared. The test DB is dropped-and-fully-migrated before the suite, so a broken `up()` fails immediately.

- **Migration:** apply `up()` then `down()`; assert the column/index appears and is fully removed (round-trip).
- **Backfill repository (integration):** seed > one batch, run the use case, assert every row is transformed and `remaining === 0`. ([write-integration-tests.md](./write-integration-tests.md))
- **Resumability (unit/integration):** stop mid-run, re-run, assert no double-processing and a correct final count.
- **Idempotency:** run the backfill twice; the second run processes zero rows.
- **Edge cases:** empty table, a batch boundary exactly at `BATCH_SIZE`, already-transformed rows.

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest
npm run test:coverage   # touched-module floor 95% (critical paths ~100%)
npm run build           # compiles clean
```

## Pitfalls

- **Missing or lossy `down()`.** A `down()` that drops data, or doesn't fully reverse `up()`, fails review. State if a `DROP` is not data-reversible.
- **`NOT NULL` on a populated table without a default.** Backfill first (expand), prove no NULLs, then tighten in a later migration.
- **One giant transaction.** Long locks on big tables stall production — chunk it and commit per batch.
- **Non-resumable backfill.** Offset-based paging shifts under writes; advance by a stable cursor and persist progress.
- **Interpolated backfill SQL.** Always bind values, even for "internal" data. ([sql-injection-review.md](./sql-injection-review.md))
- **Number collisions across branches.** Two PRs grabbing the same sequence number — renumber to the next free slot before merge.
- **Editing an already-applied migration.** Never; ship an additive corrective migration instead.
- **No verification.** Loop-exit is not proof — assert the remaining count and reconcile before switching reads.
- **Unindexed new FK/filter/sort column.** The ORM rarely auto-indexes FKs; add the index in the same file.
- **`process.env` in the runner.** Read batch sizes/feature flags through typed config, never raw env. ([17-configuration-and-environment.md](../rules/17-configuration-and-environment.md))

Related: [migration-plan.md](./migration-plan.md), [create-repository.md](./create-repository.md), [create-use-case.md](./create-use-case.md), [write-integration-tests.md](./write-integration-tests.md), [reliability-review.md](./reliability-review.md), [performance-review.md](./performance-review.md), [sql-injection-review.md](./sql-injection-review.md), [memory/database-decisions.md](../memory/database-decisions.md).
