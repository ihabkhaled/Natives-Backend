import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditOutcome } from '../model/platform.enums';
import type { AuditEntryRow } from '../model/platform.rows';
import type { NewAuditEntry } from '../model/platform.types';
import { AuditLogRepository } from './audit-log.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

const ENTRY: NewAuditEntry = {
  id: 'a-1',
  actorUserId: 'admin-1',
  action: 'outbox.replayed',
  resourceType: 'outbox_event',
  resourceId: 'ev-1',
  teamId: 'team-1',
  seasonId: null,
  correlationId: 'corr-1',
  outcome: AuditOutcome.Success,
  diff: { eventType: 'member.invited' },
  occurredAt: NOW,
};

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new AuditLogRepository();
    scope = buildScope();
  });

  it('appends an entry with a serialized diff and outcome', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.append(scope as never, ENTRY);
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[2]).toBe('outbox.replayed');
    expect(params[8]).toBe(AuditOutcome.Success);
    expect(params[9]).toBe(JSON.stringify(ENTRY.diff));
    expect(params[10]).toBe(NOW.toISOString());
  });

  it('lists a bounded, ordered page with a total', async () => {
    const row: AuditEntryRow = {
      id: 'a-1',
      actor_user_id: 'admin-1',
      action: 'outbox.replayed',
      resource_type: 'outbox_event',
      resource_id: 'ev-1',
      team_id: 'team-1',
      season_id: null,
      correlation_id: null,
      outcome: 'success',
      diff: {},
      occurred_at: NOW,
    };
    scope.run
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await repo.listByTeam(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('a-1');
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['team-1', 20, 0]);
  });

  it('defaults the total to zero when no count row returns', async () => {
    scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await repo.listByTeam(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});
