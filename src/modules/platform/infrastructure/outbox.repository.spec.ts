import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutboxStatus } from '../model/platform.enums';
import type { OutboxEventRow } from '../model/platform.rows';
import type { DomainEventEnvelope } from '../model/platform.types';
import { OutboxRepository } from './outbox.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const LATER = new Date('2026-06-01T12:00:30.000Z');

function buildScope() {
  return { run: vi.fn() };
}

const ENVELOPE: DomainEventEnvelope = {
  eventId: 'ev-1',
  aggregateType: 'membership',
  aggregateId: 'mem-1',
  eventType: 'member.invited',
  eventVersion: 1,
  actorUserId: 'admin-1',
  teamId: 'team-1',
  seasonId: null,
  correlationId: null,
  causationId: null,
  payload: { membershipId: 'mem-1' },
  occurredAt: NOW,
};

const ROW: OutboxEventRow = {
  id: 'ev-1',
  aggregate_type: 'membership',
  aggregate_id: 'mem-1',
  event_type: 'member.invited',
  event_version: 1,
  actor_user_id: 'admin-1',
  team_id: 'team-1',
  season_id: null,
  correlation_id: null,
  causation_id: null,
  payload: { membershipId: 'mem-1' },
  status: 'processing',
  attempts: 1,
  occurred_at: NOW,
};

describe('OutboxRepository', () => {
  let repo: OutboxRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new OutboxRepository();
    scope = buildScope();
  });

  it('inserts an event with a serialized payload as pending', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.insert(scope as never, ENVELOPE);
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[0]).toBe('ev-1');
    expect(params[10]).toBe(JSON.stringify(ENVELOPE.payload));
    expect(scope.run.mock.calls[0]?.[0]).toContain("'pending', 0");
  });

  it('leases a batch and maps rows to leased events', async () => {
    scope.run.mockResolvedValueOnce([ROW]);
    const leased = await repo.leaseBatch(scope as never, NOW, LATER, 50);
    expect(leased[0]?.status).toBe(OutboxStatus.Processing);
    expect(leased[0]?.attempts).toBe(1);
    expect(scope.run.mock.calls[0]?.[0]).toContain('SKIP LOCKED');
  });

  it('marks an event completed, reschedules, and dead-letters', async () => {
    scope.run.mockResolvedValue([]);
    await repo.markCompleted(scope as never, 'ev-1', NOW);
    await repo.reschedule(scope as never, 'ev-1', LATER, 'boom');
    await repo.deadLetter(scope as never, 'ev-1', 'fatal', NOW);
    expect(scope.run.mock.calls[0]?.[0]).toContain("'completed'");
    expect(scope.run.mock.calls[1]?.[1]).toEqual([
      'ev-1',
      LATER.toISOString(),
      'boom',
    ]);
    expect(scope.run.mock.calls[2]?.[0]).toContain("'dead_lettered'");
    expect(scope.run.mock.calls[2]?.[0]).toContain('"dead_lettered_at" = $3');
  });

  it('finds an event by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([ROW]);
    expect((await repo.findById(scope as never, 'ev-1'))?.eventId).toBe('ev-1');
    scope.run.mockResolvedValueOnce([]);
    expect(await repo.findById(scope as never, 'ghost')).toBeNull();
  });

  it('reports whether a requeue affected a row and clears the dead mark', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'ev-1' }]);
    expect(await repo.requeue(scope as never, 'ev-1', NOW)).toBe(true);
    expect(scope.run.mock.calls[0]?.[0]).toContain('"dead_lettered_at" = NULL');
    scope.run.mockResolvedValueOnce([]);
    expect(await repo.requeue(scope as never, 'ghost', NOW)).toBe(false);
  });

  it('reads status counts', async () => {
    scope.run.mockResolvedValueOnce([{ status: 'pending', count: 3 }]);
    const rows = await repo.metrics(scope as never);
    expect(rows[0]).toEqual({ status: 'pending', count: 3 });
  });

  it('lists a bounded dead-letter page, newest failure first, mapped', async () => {
    scope.run.mockResolvedValueOnce([
      {
        id: 'ev-1',
        event_type: 'member.invited',
        attempts: 5,
        dead_lettered_at: NOW,
        last_error: 'handler boom',
      },
    ]);

    const page = await repo.listDeadLetters(scope as never, {
      limit: 20,
      offset: 0,
    });

    expect(page).toEqual([
      {
        eventId: 'ev-1',
        eventType: 'member.invited',
        attempts: 5,
        failedAt: NOW,
        failureCode: 'handler_failed',
      },
    ]);
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`WHERE "status" = 'dead_lettered'`);
    expect(sql).toContain('COALESCE("dead_lettered_at", "occurred_at") DESC');
    expect(sql).not.toContain('"payload"');
    expect(params).toEqual([20, 0]);
  });

  it('counts dead-lettered rows, zero when none', async () => {
    scope.run.mockResolvedValueOnce([{ count: 4 }]);
    expect(await repo.countDeadLetters(scope as never)).toBe(4);
    scope.run.mockResolvedValueOnce([]);
    expect(await repo.countDeadLetters(scope as never)).toBe(0);
  });
});
