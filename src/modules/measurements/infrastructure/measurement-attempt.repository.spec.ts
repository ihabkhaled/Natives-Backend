import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementUnit } from '../model/measurements.enums';
import type { MeasurementAttemptRow } from '../model/measurements.rows';
import type { NewAttempt } from '../model/measurements.types';
import { MeasurementAttemptRepository } from './measurement-attempt.repository';

const NOW = new Date('2026-06-01T09:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new MeasurementAttemptRepository() };
}

function attemptRow(
  overrides: Partial<MeasurementAttemptRow> = {},
): MeasurementAttemptRow {
  return {
    id: 'attempt-1',
    session_id: 'session-1',
    team_id: 'team-1',
    membership_id: 'member-1',
    protocol_id: 'protocol-1',
    attempt_number: 1,
    raw_value: '3.2',
    unit: 'seconds',
    canonical_value: '3.2',
    valid: true,
    disqualified: false,
    dq_reason: null,
    evaluator_user_id: 'coach-1',
    notes: null,
    recorded_at: NOW,
    created_at: NOW,
    ...overrides,
  };
}

function newAttempt(): NewAttempt {
  return {
    id: 'attempt-1',
    sessionId: 'session-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    protocolId: 'protocol-1',
    attemptNumber: 1,
    rawValue: 3.2,
    unit: MeasurementUnit.Seconds,
    canonicalValue: 3.2,
    valid: true,
    disqualified: false,
    dqReason: null,
    evaluatorUserId: 'coach-1',
    notes: null,
    now: NOW,
  };
}

describe('MeasurementAttemptRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('short-circuits an empty insert and serializes a non-empty one', async () => {
    await harness.repository.insertMany(harness.scope as never, []);
    expect(harness.scope.run).not.toHaveBeenCalled();
    harness.scope.run.mockResolvedValueOnce([]);
    await harness.repository.insertMany(harness.scope as never, [newAttempt()]);
    const payload = JSON.parse(
      String(harness.scope.run.mock.calls[0]?.[1]?.[0]),
    );
    expect(payload[0]).toMatchObject({
      id: 'attempt-1',
      attempt_number: 1,
      canonical_value: 3.2,
    });
  });

  it('computes the next attempt base, defaulting to zero', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.nextAttemptBase(
        harness.scope as never,
        'session-1',
        'member-1',
        'protocol-1',
      ),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.nextAttemptBase(
        harness.scope as never,
        'session-1',
        'member-1',
        'protocol-1',
      ),
    ).resolves.toBe(0);
  });

  it('lists attempts by session, membership, and target', async () => {
    harness.scope.run.mockResolvedValueOnce([attemptRow()]);
    await expect(
      harness.repository.listForSession(harness.scope as never, 'session-1'),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([
      attemptRow(),
      attemptRow({ id: 'a2' }),
    ]);
    await expect(
      harness.repository.listForMembership(
        harness.scope as never,
        'team-1',
        'member-1',
      ),
    ).resolves.toHaveLength(2);
    harness.scope.run.mockResolvedValueOnce([attemptRow()]);
    await expect(
      harness.repository.listForTarget(
        harness.scope as never,
        'session-1',
        'member-1',
        'protocol-1',
      ),
    ).resolves.toHaveLength(1);
  });
});
