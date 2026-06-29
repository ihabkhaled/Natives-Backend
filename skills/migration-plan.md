# Skill: Plan a Safe, Reversible Schema Migration

> Design the schema change **before** writing a single line of DDL: forward/back compatibility, rollout order, rollback path, and a chunked backfill — written down and reviewed. This implements the canon. Authoring the migration + backfill happens in [add-migration-backfill.md](./add-migration-backfill.md); this skill produces the plan it executes. See [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## Rules this skill enforces

- **Additive-first / expand→migrate→contract** — no breaking step lands while the old code still runs. ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md))
- **Reversible** — every phase has a real `down()` or a documented roll-forward; a `DROP` is flagged as not data-reversible. ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md))
- **Backward + forward compatible** — old and new app versions both run against the in-between schema during deploy. ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md))
- **Bounded + chunked backfills** — capped, resumable batches behind the data layer; never one full-table transaction. ([09-performance-and-scalability.md](../rules/09-performance-and-scalability.md))
- **Parameterized** — every backfill binds values; zero string interpolation of data. ([08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md))
- **Observable + terminal** — the plan names the logs/metrics and the success/failure/timeout states for each phase. ([14-observability-and-logging.md](../rules/14-observability-and-logging.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md))
- **Verified, not assumed** — the plan defines how persisted state is proven before reads switch. ([11-testing-and-coverage.md](../rules/11-testing-and-coverage.md))

> ORM-agnostic and domain-agnostic. Examples use a generic SQL migration runner and illustrative names like `Order` / `Account` / `Invoice` for `<feature>` — keep the vendor (TypeORM / Prisma / Mongoose / Sequelize) behind the migration runner or a repository.

## Inspect first

1. The migrations directory and its latest sequence file — note the **next free number** and the local file/class naming.
2. The affected entity/model + repository under `src/modules/<feature>/`, and every read/write path that touches the column.
3. [memory/database-decisions.md](../memory/database-decisions.md) — prior schema/index decisions; record this plan there.
4. [reference-patterns.md](../context/reference-patterns.md) for the repository/use-case shapes the backfill will reuse.

---

## Steps

### 1. Classify the change — is it breaking?

Decide the shape before anything else. A change is **breaking** if a currently-running app version would fail against the post-migration schema.

| Change | Breaking? | Plan |
| --- | --- | --- |
| Add nullable / defaulted column, new table, new index | No | Single additive migration |
| Add `NOT NULL` to a populated column | Yes | Expand → backfill → contract |
| Rename / drop / narrow type / split column | Yes | Expand → dual-write → migrate reads → contract |
| New unique / FK constraint on existing data | Yes | Backfill + dedupe → validate → add constraint |

If the row is "Yes", you **must** split it across releases (Step 3). Never ship a breaking step in one migration.

### 2. Map compatibility: which app versions see which schema?

A deploy is never atomic — old and new pods overlap. Write down what each runtime expects so neither breaks mid-rollout.

| Phase | Schema state | Old app version | New app version |
| --- | --- | --- | --- |
| Before | old columns only | reads/writes old | n/a |
| Expand | old **+** new (nullable) | ignores new | dual-writes both |
| Migrate | both populated | reads old (still works) | reads new |
| Contract | new only | retired | reads/writes new |

The rule: **never remove or tighten a column the previous release still depends on.** Forward compatibility = old code tolerates the new column; backward compatibility = new code tolerates the old shape until contract.

### 3. Sequence the phases (expand → migrate → contract)

Each phase is its own migration + its own deploy. Sketch the per-phase artifacts.

```text
Release N    Expand    add nullable column + index; app dual-writes new+old
Release N+1  Migrate   chunked backfill old→new; flip reads to new; verify
Release N+2  Contract  drop old column (separate migration, after new shape proven)
```

For each phase capture, in the plan, the migration number, the `down()` behavior, and the deploy gate that must pass before the next phase starts.

### 4. Draft the additive migration (real `up()` + `down()`)

Idempotent DDL (`IF [NOT] EXISTS`) so a partially-applied DB re-runs cleanly. New columns are **nullable or defaulted** — never `NOT NULL` without a default on a populated table. Index every new FK / `WHERE` / `ORDER BY` column in the **same** migration.

```ts
// src/.../migrations/0042-add-invoice-issued-at.ts
import type { MigrationRunner } from '@core/database';

export class AddInvoiceIssuedAt0042 {
  public readonly name = 'AddInvoiceIssuedAt0042'; // must match the recorded ledger id

  public async up(runner: MigrationRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMPTZ NULL;`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "idx_invoices_issued_at"
         ON "invoices" ("issued_at") WHERE "issued_at" IS NOT NULL;`,
    );
  }

  public async down(runner: MigrationRunner): Promise<void> {
    await runner.query(`DROP INDEX IF EXISTS "idx_invoices_issued_at";`); // reverse order
    await runner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "issued_at";`);
  }
}
```

### 5. Design the backfill (chunked, resumable, bounded)

The backfill is **data access** — it lives behind a repository, runs in capped batches, advances by a **stable cursor** (id / created-at, never offset), and is safe to re-run from where it stopped. Bind every value; batch size is a named constant.

```ts
// src/modules/invoice/model/invoice.constants.ts
export const INVOICE_BACKFILL_BATCH_SIZE = 500 as const;

// src/modules/invoice/infrastructure/invoice.repository.ts
public async fetchUnstampedBatch(afterId: string, limit: number): Promise<InvoiceRow[]> {
  return this.db.query<InvoiceRow>(
    `SELECT id, created_at FROM "invoices"
       WHERE "id" > $1 AND "issued_at" IS NULL
       ORDER BY "id" ASC
       LIMIT $2`,
    [afterId, limit], // parameterized — never interpolate
  );
}
```

Orchestrate the loop in a **use case** (multi-step, terminal, observable) — services stay ≤20 lines. Each batch is its own transaction so a failure resumes from the last committed cursor instead of holding one giant lock. Plan emits `start` / `progress` / `finish` logs and a terminal status.

```ts
// src/modules/invoice/application/backfill-invoice-issued-at.use-case.ts
public async run(): Promise<BackfillResult> {
  let cursor = EMPTY_CURSOR;
  let processed = 0;
  for (;;) {
    const batch = await this.invoices.fetchUnstampedBatch(cursor, INVOICE_BACKFILL_BATCH_SIZE);
    if (batch.length === 0) break; // terminal: success
    processed += await this.invoices.stampIssuedAt(batch);
    cursor = batch[batch.length - 1]?.id ?? cursor;
    this.log.info('backfill_progress', { processed, cursor });
  }
  return { status: BackfillStatus.COMPLETED, processed };
}
```

### 6. Write the rollback + verification plan

Before the change ships, the plan must answer both, explicitly:

- **Rollback** — for each phase, the exact reverse. Expand/migrate are reversible (drop the new shape / flip reads back). Contract is **not** data-reversible — state the backup taken before it runs and whether recovery requires restore-from-backup.
- **Verification** — the loop exiting is not proof. Name the post-backfill assertion (`remaining === 0` or the expected residual) and the reconciliation done **before** reads switch to the new column.

```ts
const remaining = await this.invoices.countUnstamped();
this.log.info('backfill_verify', { processed, remaining });
// remaining must equal the expected residual; otherwise re-run from the cursor before flipping reads.
```

### 7. Record the plan

Capture the phase table, compatibility matrix, rollback note, and verification query in the request's `add-migration-backfill`-style artifact and in [memory/database-decisions.md](../memory/database-decisions.md). Then execute via [add-migration-backfill.md](./add-migration-backfill.md).

---

## Tests FIRST

Write/adjust tests **before** the migration runs anywhere shared. The test DB is dropped-and-fully-migrated before the suite, so a broken `up()` fails immediately.

- **Round-trip:** apply `up()` then `down()`; assert the column/index appears and is fully removed.
- **Backfill (integration):** seed > one batch, run the use case, assert every row is transformed and `remaining === 0`. ([write-integration-tests.md](./write-integration-tests.md))
- **Resumability:** stop mid-run, re-run, assert no double-processing and a correct final count.
- **Idempotency:** run twice; the second pass processes zero rows.
- **Compatibility:** with the new column present, exercise an old-shape read path and assert it still succeeds (expand-phase safety).
- **Edge cases:** empty table, a batch boundary exactly at `BATCH_SIZE`, already-transformed rows.

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # touched-module floor 95% (critical paths ~100%)
npm run build           # compiles clean
```

## Pitfalls

- **Breaking step in one migration.** `NOT NULL`, rename, drop, or type-narrow on a live table assumes a clean deploy that never happens — split into expand→migrate→contract.
- **Skipping the compatibility matrix.** The old release is still serving traffic during rollout; a dropped/tightened column it reads takes production down. Write the matrix.
- **`NOT NULL` without a default on a populated table.** Backfill first, prove no NULLs, then tighten in a later migration.
- **One giant transaction.** Long locks on big tables stall production — chunk and commit per batch.
- **Offset-based backfill.** Offsets shift under concurrent writes; advance by a stable cursor and persist progress.
- **Interpolated backfill SQL.** Always bind values, even for "internal" data. ([sql-injection-review.md](./sql-injection-review.md))
- **No rollback note on a `DROP`.** A contract step is not data-reversible by `down()` alone — name the backup and the restore path.
- **No verification.** Loop-exit is not proof — assert the remaining count and reconcile before switching reads.
- **Unindexed new FK/filter/sort column.** Add the index in the same migration; ORMs rarely auto-index FKs.
- **Sequence-number collisions across branches.** Two PRs grabbing the same number — renumber to the next free slot before merge; never edit an already-applied migration.
- **`process.env` in the runner.** Read batch sizes / feature flags through typed config, never raw env. ([17-configuration-and-environment.md](../rules/17-configuration-and-environment.md))

Related: [add-migration-backfill.md](./add-migration-backfill.md), [create-repository.md](./create-repository.md), [create-use-case.md](./create-use-case.md), [write-integration-tests.md](./write-integration-tests.md), [reliability-review.md](./reliability-review.md), [performance-review.md](./performance-review.md), [sql-injection-review.md](./sql-injection-review.md), [memory/database-decisions.md](../memory/database-decisions.md).
