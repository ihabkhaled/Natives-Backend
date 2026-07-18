import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { AttendanceRuleMissingError } from '../errors/attendance-rule-missing.error';
import {
  AttendanceRuleStatus,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceScoringRule,
  ParticipationFact,
} from '../model/attendance.types';
import { ParticipationQueryService } from './participation-query.service';

const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };

const RULE: AttendanceScoringRule = {
  code: 'legacy-candidate-v1',
  status: AttendanceRuleStatus.Candidate,
  weights: { practice: 3 },
  defaultWeight: 1,
  latePenalty: 1,
  absentPenalty: 1,
  excusedExcluded: true,
};

const FACTS: readonly ParticipationFact[] = [
  { status: AttendanceStatus.PresentOnTime, sessionType: 'practice', count: 2 },
];

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const memberships = {
    findByIdInTeam: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const records = { participationFacts: vi.fn().mockResolvedValue(FACTS) };
  const rules = { findDefault: vi.fn().mockResolvedValue(RULE) };
  const service = new ParticipationQueryService(
    unitOfWork as never,
    memberships as never,
    records as never,
    rules as never,
  );
  return { service, memberships, records, rules };
}

describe('ParticipationQueryService.getForMember', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects participation inputs against the cited rule', async () => {
    const view = await harness.service.getForMember(
      'team-1',
      'mem-1',
      'season-1',
    );
    expect(view.membershipId).toBe('mem-1');
    expect(view.seasonId).toBe('season-1');
    expect(view.ruleVersion).toBe('legacy-candidate-v1');
    expect(view.attended).toBe(2);
    expect(view.weightedPresentPoints).toBe(6);
  });

  it('rejects a membership outside the team scope', async () => {
    harness.memberships.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.service.getForMember('team-1', 'mem-x', null),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });

  it('raises when no default scoring rule is configured', async () => {
    harness.rules.findDefault.mockResolvedValue(null);
    await expect(
      harness.service.getForMember('team-1', 'mem-1', null),
    ).rejects.toBeInstanceOf(AttendanceRuleMissingError);
  });
});

describe('ParticipationQueryService.getOwn', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects the caller own participation inputs', async () => {
    const view = await harness.service.getOwn('team-1', ACTOR, null);
    expect(view.membershipId).toBe('mem-1');
    expect(view.eligibleSessions).toBe(2);
  });

  it('forbids a non-member', async () => {
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.service.getOwn('team-1', ACTOR, null),
    ).rejects.toBeInstanceOf(AttendanceNotMemberError);
  });
});
