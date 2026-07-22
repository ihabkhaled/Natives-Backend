import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobOutcome } from '../model/platform.enums';
import { JobHeartbeatRepository } from './job-heartbeat.repository';

const NOW = new Date('2026-07-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn().mockResolvedValue([]) };
}

describe('JobHeartbeatRepository', () => {
  let repository: JobHeartbeatRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new JobHeartbeatRepository();
    scope = buildScope();
  });

  it('upserts a success resetting the consecutive-failure count', async () => {
    await repository.upsert(scope as never, {
      jobKey: 'outbox.dispatcher',
      outcome: JobOutcome.Succeeded,
      now: NOW,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "job_heartbeats"');
    expect(sql).toContain('ON CONFLICT ("job_key") DO UPDATE');
    expect(sql).toContain('ELSE 0 END');
    expect(params).toEqual([
      'outbox.dispatcher',
      NOW.toISOString(),
      'succeeded',
      0,
    ]);
  });

  it('upserts a failure incrementing the consecutive-failure count', async () => {
    await repository.upsert(scope as never, {
      jobKey: 'invitations.expiry',
      outcome: JobOutcome.Failed,
      now: NOW,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`"failure_count" + 1`);
    expect(params).toEqual([
      'invitations.expiry',
      NOW.toISOString(),
      'failed',
      1,
    ]);
  });

  it('lists heartbeats bounded to the requested job keys, mapped', async () => {
    scope.run.mockResolvedValue([
      {
        job_key: 'outbox.dispatcher',
        last_run_at: NOW.toISOString(),
        last_outcome: 'succeeded',
        failure_count: 0,
      },
    ]);

    const heartbeats = await repository.listByKeys(scope as never, [
      'outbox.dispatcher',
      'invitations.expiry',
    ]);

    expect(heartbeats).toEqual([
      {
        jobKey: 'outbox.dispatcher',
        lastRunAt: NOW,
        lastOutcome: JobOutcome.Succeeded,
        failureCount: 0,
      },
    ]);
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`"job_key" = ANY($1::text[])`);
    expect(params).toEqual([['outbox.dispatcher', 'invitations.expiry']]);
  });
});
