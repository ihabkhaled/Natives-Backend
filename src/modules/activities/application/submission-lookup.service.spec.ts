import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { SubmissionLookupService } from './submission-lookup.service';

function submission(userId: string): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: userId,
    status: SubmissionStatus.Draft,
    performedOn: '2024-05-30',
    durationMinutes: null,
    quantity: null,
    notes: null,
    reviewNote: null,
    recordVersion: 1,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    withdrawnAt: null,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function build() {
  const repository = { findForWrite: vi.fn() };
  const service = new SubmissionLookupService(repository as never);
  return { repository, service, tx: {} as never };
}

describe('SubmissionLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a found submission for write', async () => {
    harness.repository.findForWrite.mockResolvedValueOnce(submission('u1'));
    await expect(
      harness.service.requireForWrite(harness.tx, 't1', 's1'),
    ).resolves.toMatchObject({ id: 's1' });
  });

  it('hides a missing submission as a 404', async () => {
    harness.repository.findForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.service.requireForWrite(harness.tx, 't1', 'sx'),
    ).rejects.toBeInstanceOf(ActivitySubmissionNotFoundError);
  });

  it('accepts the owner and hides a non-owner as a 404', () => {
    expect(() =>
      harness.service.requireOwner(submission('u1'), 'u1'),
    ).not.toThrow();
    expect(() => harness.service.requireOwner(submission('u1'), 'u2')).toThrow(
      ActivitySubmissionNotFoundError,
    );
  });
});
