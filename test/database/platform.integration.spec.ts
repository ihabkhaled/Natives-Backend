import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { InAppNotificationAdapter } from '@modules/platform/adapters/in-app-notification.adapter';
import { AuditRecorderService } from '@modules/platform/application/audit-recorder.service';
import { IdempotencyService } from '@modules/platform/application/idempotency.service';
import { NotificationProjectionService } from '@modules/platform/application/notification-projection.service';
import { ProcessOutboxBatchUseCase } from '@modules/platform/application/process-outbox-batch.use-case';
import { RecordDomainEventService } from '@modules/platform/application/record-domain-event.service';
import { IdempotencyConflictError } from '@modules/platform/errors/idempotency-conflict.error';
import { AuditLogRepository } from '@modules/platform/infrastructure/audit-log.repository';
import { IdempotencyRepository } from '@modules/platform/infrastructure/idempotency.repository';
import { NotificationRepository } from '@modules/platform/infrastructure/notification.repository';
import { NotificationDeliveryRepository } from '@modules/platform/infrastructure/notification-delivery.repository';
import { NotificationPreferenceRepository } from '@modules/platform/infrastructure/notification-preference.repository';
import { OutboxRepository } from '@modules/platform/infrastructure/outbox.repository';
import {
  MEMBER_INVITED_EVENT,
  OUTBOX_BACKOFF_CAP_MS,
} from '@modules/platform/model/platform.constants';
import {
  AuditOutcome,
  IdempotencyOutcome,
  NotificationCategory,
  NotificationChannel,
  OutboxStatus,
} from '@modules/platform/model/platform.enums';
import type { CountRow } from '@modules/platform/model/platform.rows';
import type {
  DomainEventInput,
  OutboxEventHandlerPort,
} from '@modules/platform/model/platform.types';
import { NodeEnv, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { PlatformSchema1721700000000 } from '../../src/database/migrations/1721700000000-platform-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

const TEST_DB_CONFIG = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 8,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const NOW = new Date('2026-06-01T12:00:00.000Z');
const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformSchema1721700000000,
  PlatformLifecycleSchema1723800000000,
];

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: MIGRATIONS,
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    return dataSource;
  } catch {
    return null;
  }
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Platform integration (PostgreSQL)'
  : `Platform integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

const FAILING_HANDLER: OutboxEventHandlerPort = {
  handle: () => Promise.reject(new Error('handler boom')),
};

const SILENT_LOGGER = { setContext: vi.fn(), warn: vi.fn() };

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const outbox = new OutboxRepository();
  const idempotency = new IdempotencyRepository();
  const notifications = new NotificationRepository();
  const preferences = new NotificationPreferenceRepository();
  const deliveries = new NotificationDeliveryRepository();
  const auditRepo = new AuditLogRepository();
  const idGenerator = { generate: () => randomUUID() };

  function clockAt(instant: Date) {
    return { now: () => instant, uptime: () => 0 };
  }

  afterAll(async () => {
    // Revert every applied migration (baseline → platform) so the shared test
    // database is left empty for the next suite.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [id, `user-${id}@example.test`, Role.User],
    );
    return id;
  }

  async function seedTeam(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name", "status")
       VALUES ($1, $2, 'Natives', 'active')`,
      [id, `t-${id.slice(0, 8)}`],
    );
    return id;
  }

  function eventInput(
    actorUserId: string,
    teamId: string,
    overrides: Partial<DomainEventInput> = {},
  ): DomainEventInput {
    return {
      aggregateType: 'membership',
      aggregateId: 'mem-1',
      eventType: MEMBER_INVITED_EVENT,
      eventVersion: 1,
      actorUserId,
      teamId,
      seasonId: null,
      correlationId: 'corr-1',
      causationId: null,
      payload: { membershipId: 'mem-1', email: 'a@example.test' },
      ...overrides,
    };
  }

  function projector(): NotificationProjectionService {
    return new NotificationProjectionService(
      idGenerator,
      new InAppNotificationAdapter(),
      notifications,
      preferences,
      deliveries,
    );
  }

  function worker(
    handler: OutboxEventHandlerPort,
    instant: Date,
  ): ProcessOutboxBatchUseCase {
    return new ProcessOutboxBatchUseCase(
      unitOfWork,
      clockAt(instant),
      handler,
      outbox,
      SILENT_LOGGER as never,
    );
  }

  it('migrates from empty and drops the platform schema reversibly', async () => {
    await activeDataSource.runMigrations();
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.outbox_events') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    // Two steps back: the trailing platform-lifecycle migration (a pure ALTER
    // on teams/seasons) first, then this schema, which drops its own tables.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.outbox_events') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('rolls back the outbox insert when the business transaction fails', async () => {
    const recorder = new RecordDomainEventService(
      clockAt(NOW),
      idGenerator,
      outbox,
    );
    const actorId = await seedUser();
    const teamId = await seedTeam();
    await expect(
      unitOfWork.runInTransaction(async scope => {
        await recorder.enqueue(scope, eventInput(actorId, teamId));
        throw new Error('business failure');
      }),
    ).rejects.toThrow();

    const rows = await unitOfWork.runInTransaction(scope =>
      outbox.metrics(scope),
    );
    expect(rows).toEqual([]);
  });

  it('records a redacted audit diff and reads it back', async () => {
    const recorder = new AuditRecorderService(
      clockAt(NOW),
      idGenerator,
      auditRepo,
    );
    const actorId = await seedUser();
    const teamId = await seedTeam();
    await unitOfWork.runInTransaction(scope =>
      recorder.record(scope, {
        actorUserId: actorId,
        action: 'member.invited',
        resourceType: 'membership',
        resourceId: 'mem-1',
        teamId,
        seasonId: null,
        correlationId: 'corr-1',
        outcome: AuditOutcome.Success,
        diff: { membershipId: 'mem-1', email: 'a@example.test' },
      }),
    );
    const page = await unitOfWork.runInTransaction(scope =>
      auditRepo.listByTeam(scope, teamId, { limit: 20, offset: 0 }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.diff).toEqual({
      membershipId: 'mem-1',
      email: '[redacted]',
    });
  });

  it('projects a domain event into one deduped notification with a delivery', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const recorder = new RecordDomainEventService(
      clockAt(NOW),
      idGenerator,
      outbox,
    );
    await unitOfWork.runInTransaction(scope =>
      recorder.enqueue(scope, eventInput(actorId, teamId)),
    );
    await unitOfWork.runInTransaction(scope =>
      recorder.enqueue(scope, eventInput(actorId, teamId)),
    );

    await worker(projector(), NOW).execute();
    await worker(projector(), NOW).execute();

    const counts = await unitOfWork.runInTransaction(scope =>
      scope.run<CountRow>(
        `SELECT COUNT(*)::int AS "count" FROM "notifications" WHERE "user_id" = $1`,
        [actorId],
      ),
    );
    expect(counts[0]?.count).toBe(1);

    const deliveryCounts = await unitOfWork.runInTransaction(scope =>
      scope.run<CountRow>(
        `SELECT COUNT(*)::int AS "count" FROM "notification_deliveries"
          WHERE "status" = 'sent'`,
      ),
    );
    expect(deliveryCounts[0]?.count).toBe(1);
  });

  it('suppresses a notification when the recipient disabled the category', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    await unitOfWork.runInTransaction(scope =>
      preferences.upsert(
        scope,
        actorId,
        {
          userId: actorId,
          category: NotificationCategory.MemberLifecycle,
          channel: NotificationChannel.InApp,
          enabled: false,
        },
        NOW,
      ),
    );
    const recorder = new RecordDomainEventService(
      clockAt(NOW),
      idGenerator,
      outbox,
    );
    await unitOfWork.runInTransaction(scope =>
      recorder.enqueue(scope, eventInput(actorId, teamId)),
    );
    await worker(projector(), NOW).execute();

    const counts = await unitOfWork.runInTransaction(scope =>
      scope.run<CountRow>(
        `SELECT COUNT(*)::int AS "count" FROM "notifications" WHERE "user_id" = $1`,
        [actorId],
      ),
    );
    expect(counts[0]?.count).toBe(0);
  });

  it('retries then dead-letters a permanently failing event', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const recorder = new RecordDomainEventService(
      clockAt(NOW),
      idGenerator,
      outbox,
    );
    const eventId = await unitOfWork.runInTransaction(async scope => {
      const envelope = await recorder.enqueue(
        scope,
        eventInput(actorId, teamId, { aggregateId: `dead-${randomUUID()}` }),
      );
      return envelope.eventId;
    });

    let status = OutboxStatus.Pending as string;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const instant = new Date(
        NOW.getTime() + attempt * (OUTBOX_BACKOFF_CAP_MS + 1000),
      );
      await worker(FAILING_HANDLER, instant).execute();
      const rows = await unitOfWork.runInTransaction(scope =>
        scope.run<{ status: string }>(
          `SELECT "status" FROM "outbox_events" WHERE "id" = $1`,
          [eventId],
        ),
      );
      status = rows[0]?.status ?? '';
    }
    expect(status).toBe(OutboxStatus.DeadLettered);
  });

  it('replays a completed key and conflicts on a mismatched hash', async () => {
    const service = new IdempotencyService(idGenerator, idempotency);
    const principal = await seedUser();
    const key = `key-${randomUUID()}`;
    const lookup = {
      key,
      requestHash: 'hash-1',
      principalUserId: principal,
      scopeKey: 'team-1',
      expiresAt: new Date(NOW.getTime() + 86_400_000),
      now: NOW,
    };

    const first = await unitOfWork.runInTransaction(scope =>
      service.begin(scope, lookup),
    );
    expect(first.outcome).toBe(IdempotencyOutcome.New);
    await unitOfWork.runInTransaction(scope =>
      service.complete(scope, first.recordId, 201, { id: 'created-1' }, NOW),
    );

    const replay = await unitOfWork.runInTransaction(scope =>
      service.begin(scope, lookup),
    );
    expect(replay.outcome).toBe(IdempotencyOutcome.Replay);
    expect(replay.result).toEqual({ id: 'created-1' });

    await expect(
      unitOfWork.runInTransaction(scope =>
        service.begin(scope, { ...lookup, requestHash: 'different' }),
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('never leases the same event to two concurrent workers', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const recorder = new RecordDomainEventService(
      clockAt(NOW),
      idGenerator,
      outbox,
    );
    const later = new Date(NOW.getTime() + 10 * (OUTBOX_BACKOFF_CAP_MS + 1000));
    const ids = new Set<string>();
    for (let index = 0; index < 6; index += 1) {
      const envelope = await unitOfWork.runInTransaction(scope =>
        recorder.enqueue(
          scope,
          eventInput(actorId, teamId, { aggregateId: `race-${randomUUID()}` }),
        ),
      );
      ids.add(envelope.eventId);
    }

    const [batchA, batchB] = await Promise.all([
      unitOfWork.runInTransaction(scope =>
        outbox.leaseBatch(scope, later, new Date(later.getTime() + 30000), 6),
      ),
      unitOfWork.runInTransaction(scope =>
        outbox.leaseBatch(scope, later, new Date(later.getTime() + 30000), 6),
      ),
    ]);
    const leasedIds = [...batchA, ...batchB].map(
      event => event.envelope.eventId,
    );
    const uniqueLeased = new Set(leasedIds);
    expect(uniqueLeased.size).toBe(leasedIds.length);
  });
});
