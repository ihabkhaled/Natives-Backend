import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
} from '../model/measurements.enums';
import type {
  MeasurementAttempt,
  MeasurementProtocol,
} from '../model/measurements.types';
import { MeasurementHistoryService } from './measurement-history.service';

const NOW = new Date('2026-06-01T09:00:00.000Z');

function protocol(): MeasurementProtocol {
  return {
    id: 'protocol-1',
    teamId: 'team-1',
    seasonId: null,
    protocolKey: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: null,
    maxValue: null,
    status: ProtocolStatus.Active,
    recordVersion: 1,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function attempt(
  canonicalValue: number,
  attemptNumber: number,
): MeasurementAttempt {
  return {
    id: `attempt-${attemptNumber}`,
    sessionId: 'session-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    protocolId: 'protocol-1',
    attemptNumber,
    rawValue: canonicalValue,
    unit: MeasurementUnit.Seconds,
    canonicalValue,
    valid: true,
    disqualified: false,
    dqReason: null,
    evaluatorUserId: 'coach-1',
    notes: null,
    recordedAt: NOW,
    createdAt: NOW,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const scope = {
    validate: vi.fn(),
    requireMembership: vi.fn(),
    resolveMembershipForUser: vi.fn(),
  };
  const protocols = { listByIds: vi.fn() };
  const attempts = { listForMembership: vi.fn() };
  return {
    scope,
    protocols,
    attempts,
    service: new MeasurementHistoryService(
      unitOfWork as never,
      scope as never,
      protocols as never,
      attempts as never,
    ),
  };
}

describe('MeasurementHistoryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
    harness.attempts.listForMembership.mockResolvedValue([
      attempt(3.4, 1),
      attempt(3.1, 2),
    ]);
    harness.protocols.listByIds.mockResolvedValue([protocol()]);
  });

  it('builds a membership history with the derived best result', async () => {
    const history = await harness.service.getForMembership(
      'team-1',
      'member-1',
    );
    expect(harness.scope.requireMembership).toHaveBeenCalled();
    expect(history.membershipId).toBe('member-1');
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]?.result.best).toBe(3.1);
  });

  it('resolves the caller membership for the self history read', async () => {
    harness.scope.resolveMembershipForUser.mockResolvedValue('member-1');
    const history = await harness.service.getForUser('team-1', 'user-1');
    expect(harness.scope.resolveMembershipForUser).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'user-1',
    );
    expect(history.membershipId).toBe('member-1');
  });
});
