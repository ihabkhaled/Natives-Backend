import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { AttendanceState, AttendanceStatus } from '../model/attendance.enums';
import type { SelfHistoryEntry } from '../model/attendance.types';
import { AttendanceSelfHistoryQueryService } from './attendance-self-history.query.service';

const NOW = new Date('2026-06-01T15:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };
const PAGE = { limit: 20, offset: 0 };

const RECORDED_ENTRY: SelfHistoryEntry = {
  sessionId: 'ses-2',
  startsAt: new Date('2026-05-30T15:00:00.000Z'),
  endsAt: new Date('2026-05-30T17:00:00.000Z'),
  sessionType: 'practice',
  status: AttendanceStatus.PresentOnTime,
  latenessMinutes: null,
  excuseCategory: null,
  source: null,
  recordedAt: NOW,
  sheetState: AttendanceState.Finalized,
};

const UNRECORDED_ENTRY: SelfHistoryEntry = {
  sessionId: 'ses-1',
  startsAt: new Date('2026-05-28T15:00:00.000Z'),
  endsAt: new Date('2026-05-28T17:00:00.000Z'),
  sessionType: 'practice',
  status: null,
  latenessMinutes: null,
  excuseCategory: null,
  source: null,
  recordedAt: null,
  sheetState: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const memberships = {
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const records = {
    selfHistory: vi.fn().mockResolvedValue([RECORDED_ENTRY, UNRECORDED_ENTRY]),
    countSelfHistory: vi.fn().mockResolvedValue(12),
  };
  const service = new AttendanceSelfHistoryQueryService(
    unitOfWork as never,
    clock,
    memberships as never,
    records as never,
  );
  return { service, memberships, records };
}

describe('AttendanceSelfHistoryQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects the paginated envelope with null-record rows intact', async () => {
    const view = await harness.service.getOwn('team-1', ACTOR, {
      seasonId: null,
      page: PAGE,
    });
    expect(view.items).toEqual([RECORDED_ENTRY, UNRECORDED_ENTRY]);
    expect(view.total).toBe(12);
    expect(view.limit).toBe(20);
    expect(view.offset).toBe(0);
  });

  it('resolves the caller membership from the token and scans with it', async () => {
    await harness.service.getOwn('team-1', ACTOR, {
      seasonId: 'season-1',
      page: PAGE,
    });
    expect(harness.memberships.findActiveByUser).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'user-1',
    );
    const scan = {
      teamId: 'team-1',
      membershipId: 'mem-1',
      seasonId: 'season-1',
      now: NOW,
      page: PAGE,
    };
    expect(harness.records.selfHistory).toHaveBeenCalledWith(SCOPE, scan);
    expect(harness.records.countSelfHistory).toHaveBeenCalledWith(SCOPE, scan);
  });

  it('forbids a caller with no active membership', async () => {
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.service.getOwn('team-1', ACTOR, { seasonId: null, page: PAGE }),
    ).rejects.toBeInstanceOf(AttendanceNotMemberError);
    expect(harness.records.selfHistory).not.toHaveBeenCalled();
  });
});
