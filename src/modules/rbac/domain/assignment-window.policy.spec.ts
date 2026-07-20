import { describe, expect, it } from 'vitest';

import type { RoleAssignment } from '../model/rbac.types';
import {
  assignmentAppliesToScope,
  assignmentIsLive,
} from './assignment-window.policy';

const NOW = new Date('2026-07-20T12:00:00.000Z');

function assignment(overrides: Partial<RoleAssignment> = {}): RoleAssignment {
  return {
    id: 'assignment-1',
    userId: 'user-1',
    roleId: 'role-1',
    roleKey: 'COACH',
    teamId: 'team-1',
    seasonId: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    grantedBy: 'admin-1',
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
    ...overrides,
  };
}

describe('assignmentIsLive', () => {
  it('accepts an open-ended assignment whose window has opened', () => {
    expect(assignmentIsLive(assignment(), NOW)).toBe(true);
  });

  it('rejects a revoked assignment', () => {
    expect(assignmentIsLive(assignment({ revokedAt: NOW }), NOW)).toBe(false);
  });

  it('rejects an assignment that has not started yet', () => {
    const future = assignment({
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(assignmentIsLive(future, NOW)).toBe(false);
  });

  it('rejects an assignment whose window already closed', () => {
    const expired = assignment({
      effectiveTo: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(assignmentIsLive(expired, NOW)).toBe(false);
  });

  it('accepts an assignment whose window is still open', () => {
    const bounded = assignment({
      effectiveTo: new Date('2026-12-31T00:00:00.000Z'),
    });

    expect(assignmentIsLive(bounded, NOW)).toBe(true);
  });

  it('treats the exact start instant as already open', () => {
    expect(assignmentIsLive(assignment({ effectiveFrom: NOW }), NOW)).toBe(
      true,
    );
  });
});

describe('assignmentAppliesToScope', () => {
  it('applies a global assignment to any team', () => {
    const global = assignment({ teamId: null });

    expect(assignmentAppliesToScope(global, 'team-9', null)).toBe(true);
  });

  it('never applies a team assignment to another team', () => {
    expect(assignmentAppliesToScope(assignment(), 'team-2', null)).toBe(false);
  });

  it('applies a season-less assignment inside any season of its team', () => {
    expect(assignmentAppliesToScope(assignment(), 'team-1', 'season-1')).toBe(
      true,
    );
  });

  it('applies a season-bound assignment only within that season', () => {
    const bound = assignment({ seasonId: 'season-1' });

    expect(assignmentAppliesToScope(bound, 'team-1', 'season-1')).toBe(true);
    expect(assignmentAppliesToScope(bound, 'team-1', 'season-2')).toBe(false);
    expect(assignmentAppliesToScope(bound, 'team-1', null)).toBe(false);
  });
});
