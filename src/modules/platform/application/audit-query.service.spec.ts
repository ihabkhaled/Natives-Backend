import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditQueryService } from './audit-query.service';

const SCOPE = {} as never;

function build() {
  const paged = { items: [], total: 0, limit: 20, offset: 0 };
  const repository = { listByTeam: vi.fn().mockResolvedValue(paged) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new AuditQueryService(
    unitOfWork as never,
    repository as never,
  );
  return { service, repository, paged };
}

describe('AuditQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('delegates a bounded team read inside a transaction', async () => {
    const page = { limit: 20, offset: 0 };
    const result = await harness.service.listForTeam('team-1', page);
    expect(result).toBe(harness.paged);
    expect(harness.repository.listByTeam).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      page,
    );
  });
});
