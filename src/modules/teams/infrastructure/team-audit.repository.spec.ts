import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamAuditRepository } from './team-audit.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

describe('TeamAuditRepository', () => {
  let repository: TeamAuditRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new TeamAuditRepository();
    scope = buildScope();
  });

  it('appends an audit event as jsonb into security_events', async () => {
    scope.run.mockResolvedValue([]);

    await repository.append(scope as never, {
      id: 'event-1',
      eventType: 'team.created',
      actorUserId: 'admin-1',
      context: { teamId: 'team-1', slug: 'natives' },
      occurredAt: NOW,
    });

    expect(scope.run.mock.calls[0]?.[0]).toContain('security_events');
    expect(scope.run.mock.calls[0]?.[1]?.[3]).toBe(
      JSON.stringify({ teamId: 'team-1', slug: 'natives' }),
    );
    expect(scope.run.mock.calls[0]?.[1]?.[4]).toBe(NOW.toISOString());
  });
});
