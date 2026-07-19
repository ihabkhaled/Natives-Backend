import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStatus } from '../model/measurements.enums';
import type { MeasurementSessionRow } from '../model/measurements.rows';
import type {
  NewSession,
  SessionContent,
  SessionStatusChange,
} from '../model/measurements.types';
import { MeasurementSessionRepository } from './measurement-session.repository';

const NOW = new Date('2026-06-01T09:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new MeasurementSessionRepository() };
}

function sessionRow(
  overrides: Partial<MeasurementSessionRow> = {},
): MeasurementSessionRow {
  return {
    id: 'session-1',
    team_id: 'team-1',
    season_id: null,
    title: 'Combine',
    status: 'scheduled',
    scheduled_at: NOW,
    conducted_at: null,
    location: null,
    conditions: null,
    notes: null,
    record_version: 1,
    created_by: 'coach-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function content(): SessionContent {
  return {
    title: 'Combine',
    seasonId: null,
    scheduledAt: '2026-06-01T09:00:00.000Z',
    location: null,
    conditions: null,
    notes: null,
  };
}

function newSession(): NewSession {
  return {
    id: 'session-1',
    teamId: 'team-1',
    content: content(),
    createdBy: 'coach-1',
    now: NOW,
  };
}

function statusChange(): SessionStatusChange {
  return {
    id: 'session-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: SessionStatus.Conducted,
    conductedAt: NOW,
    now: NOW,
  };
}

describe('MeasurementSessionRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a session and throws when no row returns', async () => {
    harness.scope.run.mockResolvedValueOnce([sessionRow()]);
    await expect(
      harness.repository.insert(harness.scope as never, newSession()),
    ).resolves.toMatchObject({ id: 'session-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insert(harness.scope as never, newSession()),
    ).rejects.toThrow('Expected a returned row');
  });

  it('finds a session for write or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([sessionRow()]);
    await expect(
      harness.repository.findForWrite(
        harness.scope as never,
        'team-1',
        'session-1',
      ),
    ).resolves.toMatchObject({ id: 'session-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findForWrite(
        harness.scope as never,
        'team-1',
        'session-1',
      ),
    ).resolves.toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    harness.scope.run.mockResolvedValueOnce([
      sessionRow({ status: 'conducted', conducted_at: NOW }),
    ]);
    await expect(
      harness.repository.applyStatusChange(
        harness.scope as never,
        statusChange(),
      ),
    ).resolves.toMatchObject({ status: SessionStatus.Conducted });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyStatusChange(
        harness.scope as never,
        statusChange(),
      ),
    ).resolves.toBeNull();
  });

  it('lists and counts sessions for a team', async () => {
    harness.scope.run.mockResolvedValueOnce([sessionRow()]);
    await expect(
      harness.repository.listForTeam(harness.scope as never, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(2);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });
});
