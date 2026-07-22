import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeadLetter } from '../model/platform.types';
import { DeadLetterQueryService } from './dead-letter-query.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const DEAD_LETTER: DeadLetter = {
  eventId: 'evt-1',
  eventType: 'member.invited',
  attempts: 5,
  failedAt: NOW,
  failureCode: 'handler_failed',
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const outbox = {
    listDeadLetters: vi.fn().mockResolvedValue([DEAD_LETTER]),
    countDeadLetters: vi.fn().mockResolvedValue(7),
  };
  const service = new DeadLetterQueryService(
    unitOfWork as never,
    outbox as never,
  );
  return { service, outbox, scope };
}

describe('DeadLetterQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the page with the authoritative total and echoed window', async () => {
    const page = await harness.service.list({ limit: 20, offset: 40 });

    expect(page).toEqual({
      items: [DEAD_LETTER],
      total: 7,
      limit: 20,
      offset: 40,
    });
    expect(harness.outbox.listDeadLetters).toHaveBeenCalledWith(harness.scope, {
      limit: 20,
      offset: 40,
    });
    expect(harness.outbox.countDeadLetters).toHaveBeenCalledWith(harness.scope);
  });

  it('returns the honest zero-state when nothing is dead-lettered', async () => {
    harness.outbox.listDeadLetters.mockResolvedValue([]);
    harness.outbox.countDeadLetters.mockResolvedValue(0);

    await expect(
      harness.service.list({ limit: 20, offset: 0 }),
    ).resolves.toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });
});
