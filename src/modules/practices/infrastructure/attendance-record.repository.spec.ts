import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  RosterEntryRow,
  SelfHistoryEntryRow,
} from '../model/attendance.rows';
import { RsvpStatus } from '../model/rsvp.enums';
import { AttendanceRecordRepository } from './attendance-record.repository';

const NOW = new Date('2026-06-01T15:00:00.000Z');
const PAGE = { limit: 20, offset: 0 };

function scopeReturning(rows: readonly unknown[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(rows);
  return { scope: { run }, run };
}

function rosterRow(overrides: Partial<RosterEntryRow> = {}): RosterEntryRow {
  return {
    membership_id: 'mem-1',
    user_id: 'user-1',
    display_name: 'Sara Ahmed',
    rsvp_status: 'going',
    status: 'present_on_time',
    check_in_at: NOW,
    lateness_minutes: null,
    excuse_category: null,
    source: 'self',
    version: 1,
    ...overrides,
  };
}

function historyRow(
  overrides: Partial<SelfHistoryEntryRow> = {},
): SelfHistoryEntryRow {
  return {
    session_id: 'ses-1',
    starts_at: NOW,
    ends_at: new Date('2026-06-01T17:00:00.000Z'),
    session_type: 'practice',
    status: 'present_late',
    lateness_minutes: 7,
    excuse_category: null,
    source: 'self',
    recorded_at: NOW,
    sheet_state: 'finalized',
    ...overrides,
  };
}

describe('AttendanceRecordRepository', () => {
  let repository: AttendanceRecordRepository;

  beforeEach(() => {
    repository = new AttendanceRecordRepository();
  });

  describe('listRoster', () => {
    it('maps identity, RSVP and mark columns', async () => {
      const { scope } = scopeReturning([rosterRow()]);
      const entries = await repository.listRoster(scope, 't-1', 's-1', PAGE);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          membershipId: 'mem-1',
          displayName: 'Sara Ahmed',
          rsvpStatus: RsvpStatus.Going,
          status: AttendanceStatus.PresentOnTime,
          source: AttendanceSource.Self,
        }),
      );
    });

    it('is null-safe when profile, user, RSVP and mark are all absent', async () => {
      const { scope } = scopeReturning([
        rosterRow({
          user_id: null,
          display_name: null,
          rsvp_status: null,
          status: null,
          check_in_at: null,
          source: null,
          version: null,
        }),
      ]);
      const entries = await repository.listRoster(scope, 't-1', 's-1', PAGE);
      expect(entries[0]).toEqual({
        membershipId: 'mem-1',
        userId: null,
        displayName: null,
        rsvpStatus: null,
        status: null,
        checkInAt: null,
        latenessMinutes: null,
        excuseCategory: null,
        source: null,
        version: null,
      });
    });
  });

  describe('selfHistory', () => {
    it('maps a recorded row including the sheet state', async () => {
      const { scope, run } = scopeReturning([historyRow()]);
      const items = await repository.selfHistory(scope, {
        teamId: 't-1',
        membershipId: 'mem-1',
        seasonId: null,
        now: NOW,
        page: PAGE,
      });
      expect(items[0]).toEqual({
        sessionId: 'ses-1',
        startsAt: NOW,
        endsAt: new Date('2026-06-01T17:00:00.000Z'),
        sessionType: 'practice',
        status: AttendanceStatus.PresentLate,
        latenessMinutes: 7,
        excuseCategory: null,
        source: AttendanceSource.Self,
        recordedAt: NOW,
        sheetState: AttendanceState.Finalized,
      });
      const params = run.mock.calls[0]?.[1] as readonly unknown[];
      expect(params).toContain('mem-1');
      expect(params).toContain(PAGE.limit);
    });

    it('returns a null-status row for a session without a record', async () => {
      const { scope } = scopeReturning([
        historyRow({
          status: null,
          lateness_minutes: null,
          source: null,
          recorded_at: null,
          sheet_state: null,
        }),
      ]);
      const items = await repository.selfHistory(scope, {
        teamId: 't-1',
        membershipId: 'mem-1',
        seasonId: 'season-1',
        now: NOW,
        page: PAGE,
      });
      expect(items[0]?.status).toBeNull();
      expect(items[0]?.recordedAt).toBeNull();
      expect(items[0]?.sheetState).toBeNull();
    });
  });

  describe('countSelfHistory', () => {
    it('returns the bounded scan count (0 when empty)', async () => {
      const { scope } = scopeReturning([]);
      await expect(
        repository.countSelfHistory(scope, {
          teamId: 't-1',
          membershipId: 'mem-1',
          seasonId: null,
          now: NOW,
          page: PAGE,
        }),
      ).resolves.toBe(0);
    });
  });
});
