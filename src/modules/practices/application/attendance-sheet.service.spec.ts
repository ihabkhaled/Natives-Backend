import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceLockedError } from '../errors/attendance-locked.error';
import { AttendanceSheetNotFoundError } from '../errors/attendance-sheet-not-found.error';
import { AttendanceState } from '../model/attendance.enums';
import type { AttendanceSheet } from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceSheetService } from './attendance-sheet.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

function session(): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: null,
    meetAt: null,
    startsAt: NOW,
    endsAt: NOW,
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status: SessionStatus.Published,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function sheet(state: AttendanceState): AttendanceSheet {
  return {
    id: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    state,
    finalizedAt: null,
    finalizedBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build() {
  const sheets = {
    insertSheet: vi.fn(),
    findBySession: vi.fn(),
    finalize: vi.fn(),
    applyCorrection: vi.fn(),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const service = new AttendanceSheetService(idGenerator, sheets as never);
  return { service, sheets };
}

describe('AttendanceSheetService.ensureOpenSheet', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the freshly created open sheet without re-reading', async () => {
    harness.sheets.insertSheet.mockResolvedValue(sheet(AttendanceState.Open));
    const result = await harness.service.ensureOpenSheet(
      SCOPE,
      session(),
      'coach-1',
      NOW,
    );
    expect(result.state).toBe(AttendanceState.Open);
    expect(harness.sheets.findBySession).not.toHaveBeenCalled();
  });

  it('re-reads an existing sheet when the insert conflicts', async () => {
    harness.sheets.insertSheet.mockResolvedValue(null);
    harness.sheets.findBySession.mockResolvedValue(sheet(AttendanceState.Open));
    const result = await harness.service.ensureOpenSheet(
      SCOPE,
      session(),
      'coach-1',
      NOW,
    );
    expect(result.id).toBe('sheet-1');
  });

  it('rejects recording into a finalized sheet', async () => {
    harness.sheets.insertSheet.mockResolvedValue(null);
    harness.sheets.findBySession.mockResolvedValue(
      sheet(AttendanceState.Finalized),
    );
    await expect(
      harness.service.ensureOpenSheet(SCOPE, session(), 'coach-1', NOW),
    ).rejects.toBeInstanceOf(AttendanceLockedError);
  });

  it('raises not-found when neither insert nor read yields a sheet', async () => {
    harness.sheets.insertSheet.mockResolvedValue(null);
    harness.sheets.findBySession.mockResolvedValue(null);
    await expect(
      harness.service.ensureOpenSheet(SCOPE, session(), 'coach-1', NOW),
    ).rejects.toBeInstanceOf(AttendanceSheetNotFoundError);
  });
});

describe('AttendanceSheetService.requireSheet', () => {
  it('returns an existing sheet', async () => {
    const harness = build();
    harness.sheets.findBySession.mockResolvedValue(
      sheet(AttendanceState.Finalized),
    );
    const result = await harness.service.requireSheet(SCOPE, 'ses-1');
    expect(result.state).toBe(AttendanceState.Finalized);
  });

  it('raises not-found for a session with no sheet', async () => {
    const harness = build();
    harness.sheets.findBySession.mockResolvedValue(null);
    await expect(
      harness.service.requireSheet(SCOPE, 'ses-1'),
    ).rejects.toBeInstanceOf(AttendanceSheetNotFoundError);
  });
});
