import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmissionRow } from '../model/activity.rows';
import type {
  NewActivitySubmission,
  SubmissionContent,
  SubmissionContentUpdate,
  SubmissionStatusChange,
} from '../model/activity.types';
import { ActivitySubmissionRepository } from './activity-submission.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const CONTENT: SubmissionContent = {
  activityTypeId: 'type-1',
  seasonId: null,
  performedOn: '2024-05-30',
  durationMinutes: 60,
  quantity: null,
  notes: 'note',
};

const ROW: ActivitySubmissionRow = {
  id: 's1',
  team_id: 't1',
  season_id: null,
  membership_id: 'm1',
  activity_type_id: 'type-1',
  submitter_user_id: 'u1',
  status: 'draft',
  performed_on: '2024-05-30',
  duration_minutes: 60,
  quantity: null,
  notes: 'note',
  review_note: null,
  record_version: 1,
  submitted_at: null,
  submitted_by: null,
  reviewed_at: null,
  reviewed_by: null,
  withdrawn_at: null,
  created_by: 'u1',
  created_at: '2024-05-30T00:00:00.000Z',
  updated_at: '2024-05-30T00:00:00.000Z',
  deleted_at: null,
};

const NEW_SUBMISSION: NewActivitySubmission = {
  id: 's1',
  teamId: 't1',
  membershipId: 'm1',
  submitterUserId: 'u1',
  status: SubmissionStatus.Draft,
  content: CONTENT,
  now: NOW,
};

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ActivitySubmissionRepository() };
}

describe('ActivitySubmissionRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a submission and maps the returned row', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    const submission = await harness.repository.insert(
      harness.scope as never,
      NEW_SUBMISSION,
    );
    expect(submission.id).toBe('s1');
    expect(harness.scope.run.mock.calls[0]?.[1]?.[0]).toBe('s1');
  });

  it('throws when the insert returns no row', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insert(harness.scope as never, NEW_SUBMISSION),
    ).rejects.toThrow('Expected a returned row');
  });

  it('detects a live duplicate claim and its absence', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 's2' }]);
    await expect(
      harness.repository.existsLiveForMember(
        harness.scope as never,
        'm1',
        'type-1',
        '2024-05-30',
        null,
      ),
    ).resolves.toBe(true);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" NOT IN ('withdrawn', 'rejected', 'reversed')`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.existsLiveForMember(
        harness.scope as never,
        'm1',
        'type-1',
        '2024-05-30',
        's1',
      ),
    ).resolves.toBe(false);
  });

  it('finds a submission for write or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 't1', 's1'),
    ).resolves.toMatchObject({ id: 's1' });

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 't1', 'sx'),
    ).resolves.toBeNull();
  });

  it('updates content under an optimistic guard or returns null', async () => {
    const update: SubmissionContentUpdate = {
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 1,
      content: CONTENT,
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([{ ...ROW, record_version: 2 }]);
    await expect(
      harness.repository.updateContent(harness.scope as never, update),
    ).resolves.toMatchObject({ recordVersion: 2 });

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.updateContent(harness.scope as never, update),
    ).resolves.toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    const change: SubmissionStatusChange = {
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 1,
      toStatus: SubmissionStatus.Submitted,
      actorUserId: 'u1',
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([{ ...ROW, status: 'submitted' }]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, change),
    ).resolves.toMatchObject({ status: SubmissionStatus.Submitted });
    expect(harness.scope.run.mock.calls[0]?.[1]?.[3]).toBe(
      SubmissionStatus.Submitted,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, change),
    ).resolves.toBeNull();
  });

  it('lists and counts a member’s submissions', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    await expect(
      harness.repository.listForMember(harness.scope as never, 't1', 'u1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toHaveLength(1);

    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.countForMember(harness.scope as never, 't1', 'u1'),
    ).resolves.toBe(3);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForMember(harness.scope as never, 't1', 'u1'),
    ).resolves.toBe(0);
  });
});
