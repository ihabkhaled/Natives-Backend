import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SecurityEventType } from '../model/identity.enums';
import { SecurityAuditService } from './security-audit.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('event-id') };
  const events = { append: vi.fn() };

  const service = new SecurityAuditService(clock, idGenerator, events);

  return { service, clock, idGenerator, events };
}

describe('SecurityAuditService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends a security event with a generated id and clock instant', async () => {
    const scope = { marker: 'scope' };

    await harness.service.record(
      scope as never,
      SecurityEventType.LoginSucceeded,
      'user-1',
      { attempt: 1 },
    );

    expect(harness.events.append).toHaveBeenCalledWith(scope, {
      id: 'event-id',
      eventType: SecurityEventType.LoginSucceeded,
      actorUserId: 'user-1',
      context: { attempt: 1 },
      occurredAt: NOW,
    });
  });

  it('passes a null actor through unchanged', async () => {
    await harness.service.record(
      {} as never,
      SecurityEventType.LoginFailed,
      null,
      {},
    );

    expect(harness.events.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: null,
        eventType: SecurityEventType.LoginFailed,
        context: {},
      }),
    );
  });
});
