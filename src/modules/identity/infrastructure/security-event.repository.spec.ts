import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SecurityEventType } from '../model/identity.enums';
import { SecurityEventRepository } from './security-event.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

describe('SecurityEventRepository', () => {
  let repository: SecurityEventRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new SecurityEventRepository();
    scope = createScope();
  });

  it('appends a security event with a serialized context payload', async () => {
    scope.run.mockResolvedValue([]);
    const occurredAt = new Date('2026-01-01T00:00:00.000Z');
    const context = { userId: 'user-1', attempt: 3, locked: true };

    await repository.append(scope as unknown as TransactionScope, {
      id: 'evt-1',
      eventType: SecurityEventType.LoginFailed,
      actorUserId: 'user-1',
      context,
      occurredAt,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "security_events"');
    expect(params).toEqual([
      'evt-1',
      SecurityEventType.LoginFailed,
      'user-1',
      JSON.stringify(context),
      occurredAt.toISOString(),
    ]);
  });

  it('appends an event with a null actor and empty context', async () => {
    scope.run.mockResolvedValue([]);
    const occurredAt = new Date('2026-01-02T00:00:00.000Z');

    await repository.append(scope as unknown as TransactionScope, {
      id: 'evt-2',
      eventType: SecurityEventType.LoginSucceeded,
      actorUserId: null,
      context: {},
      occurredAt,
    });

    const [, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([
      'evt-2',
      SecurityEventType.LoginSucceeded,
      null,
      JSON.stringify({}),
      occurredAt.toISOString(),
    ]);
  });
});
