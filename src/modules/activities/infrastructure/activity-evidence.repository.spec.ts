import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EvidenceKind } from '../model/activity.enums';
import type { ActivityEvidenceRow } from '../model/activity.rows';
import type { NewActivityEvidence } from '../model/activity.types';
import { ActivityEvidenceRepository } from './activity-evidence.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const NEW_EVIDENCE: NewActivityEvidence = {
  id: 'e1',
  submissionId: 's1',
  item: {
    kind: EvidenceKind.Link,
    storageReference: 'private/ref',
    contentType: null,
    byteSize: null,
    description: null,
  },
  createdBy: 'u1',
  now: NOW,
};

const ROW: ActivityEvidenceRow = {
  id: 'e1',
  submission_id: 's1',
  kind: 'link',
  storage_reference: 'private/ref',
  content_type: null,
  byte_size: null,
  description: null,
  scan_status: 'pending',
  created_by: 'u1',
  created_at: '2024-06-01T00:00:00.000Z',
};

function build() {
  const scope = { run: vi.fn().mockResolvedValue([]) };
  return { scope, repository: new ActivityEvidenceRepository() };
}

describe('ActivityEvidenceRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('skips the write when there is no evidence', async () => {
    await harness.repository.insertMany(harness.scope as never, []);
    expect(harness.scope.run).not.toHaveBeenCalled();
  });

  it('inserts evidence via a jsonb recordset', async () => {
    await harness.repository.insertMany(harness.scope as never, [NEW_EVIDENCE]);
    const payload = JSON.parse(
      String(harness.scope.run.mock.calls[0]?.[1]?.[0]),
    );
    expect(payload[0]).toMatchObject({
      id: 'e1',
      submission_id: 's1',
      storage_reference: 'private/ref',
    });
  });

  it('clears a submission’s evidence', async () => {
    await harness.repository.clearForSubmission(harness.scope as never, 's1');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain('DELETE');
  });

  it('lists a submission’s evidence with its private reference', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    const items = await harness.repository.listForSubmission(
      harness.scope as never,
      's1',
    );
    expect(items[0]?.storageReference).toBe('private/ref');
  });

  it('counts a submission’s evidence and defaults to zero', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 4 }]);
    await expect(
      harness.repository.countForSubmission(harness.scope as never, 's1'),
    ).resolves.toBe(4);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForSubmission(harness.scope as never, 's1'),
    ).resolves.toBe(0);
  });

  it('groups evidence counts by submission, empty for no ids', async () => {
    await expect(
      harness.repository.countsBySubmission(harness.scope as never, []),
    ).resolves.toEqual(new Map());

    harness.scope.run.mockResolvedValueOnce([
      { submission_id: 's1', count: 2 },
      { submission_id: 's2', count: 1 },
    ]);
    const counts = await harness.repository.countsBySubmission(
      harness.scope as never,
      ['s1', 's2'],
    );
    expect(counts.get('s1')).toBe(2);
    expect(counts.get('s2')).toBe(1);
  });
});
