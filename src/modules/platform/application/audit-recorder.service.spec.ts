import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REDACTED_VALUE } from '../model/platform.constants';
import { AuditOutcome } from '../model/platform.enums';
import type { AuditInput } from '../model/platform.types';
import { AuditRecorderService } from './audit-recorder.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen-1') };
  const repository = { append: vi.fn().mockResolvedValue(undefined) };
  const service = new AuditRecorderService(
    clock,
    idGenerator,
    repository as never,
  );
  return { service, repository };
}

const INPUT: AuditInput = {
  actorUserId: 'admin-1',
  action: 'member.invited',
  resourceType: 'membership',
  resourceId: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  correlationId: 'corr-1',
  outcome: AuditOutcome.Success,
  diff: { membershipId: 'mem-1', email: 'a@example.test' },
};

describe('AuditRecorderService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('redacts the diff and stamps id + occurrence time', async () => {
    await harness.service.record(SCOPE, INPUT);
    const entry = harness.repository.append.mock.calls[0]?.[1];
    expect(entry).toMatchObject({
      id: 'gen-1',
      occurredAt: NOW,
      diff: { membershipId: 'mem-1', email: REDACTED_VALUE },
    });
  });
});
