import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MEMBER_INVITED_EVENT } from '../model/members.constants';
import type { NewAuditEvent } from '../model/members.types';
import { MemberAuditRepository } from './member-audit.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

describe('MemberAuditRepository', () => {
  let repo: MemberAuditRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new MemberAuditRepository();
    scope = buildScope();
  });

  it('appends a redacted audit event with a serialized context', async () => {
    scope.run.mockResolvedValueOnce([]);
    const event: NewAuditEvent = {
      id: 'ev-1',
      eventType: MEMBER_INVITED_EVENT,
      actorUserId: 'admin-1',
      context: { membershipId: 'mem-1', teamId: 'team-1' },
      occurredAt: NOW,
    };
    await repo.append(scope as never, event);
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[1]).toBe(MEMBER_INVITED_EVENT);
    expect(params[3]).toBe(JSON.stringify(event.context));
  });
});
