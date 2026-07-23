import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionListFilter } from '../model/practices.types';
import { SessionQueryService } from './session-query.service';

const SCOPE = {} as never;
const FILTER: SessionListFilter = {
  from: null,
  to: null,
  status: null,
  sessionType: null,
  seasonId: null,
  scheduleId: null,
  limit: 20,
  offset: 0,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const sessions = {
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
  };
  const statusEvents = {
    listBySession: vi.fn().mockResolvedValue([{ id: 'evt-1' }]),
  };
  const lookup = { requireSession: vi.fn().mockResolvedValue({ id: 'ses-1' }) };
  const service = new SessionQueryService(
    unitOfWork as never,
    sessions as never,
    statusEvents as never,
    lookup as never,
  );
  return { service, sessions, statusEvents, lookup };
}

describe('SessionQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists sessions with the resolved filter', async () => {
    const result = await harness.service.listSessions('team-1', FILTER);
    expect(result.total).toBe(0);
    expect(harness.sessions.list).toHaveBeenCalledWith(SCOPE, 'team-1', FILTER);
  });

  it('resolves a single session within team scope', async () => {
    const result = await harness.service.getSession('team-1', 'ses-1');
    expect(result).toEqual({ id: 'ses-1' });
  });

  it('returns the status history only after the session resolves', async () => {
    const result = await harness.service.listHistory('team-1', 'ses-1');
    expect(harness.lookup.requireSession).toHaveBeenCalledOnce();
    expect(result.items).toEqual([{ id: 'evt-1' }]);
  });
});
