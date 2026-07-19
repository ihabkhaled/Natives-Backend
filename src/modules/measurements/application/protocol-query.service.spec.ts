import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementProtocolNotFoundError } from '../errors/measurement-protocol-not-found.error';
import { ProtocolQueryService } from './protocol-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const repository = {
    listForTeam: vi.fn(),
    countForTeam: vi.fn(),
    findVisible: vi.fn(),
  };
  return {
    repository,
    service: new ProtocolQueryService(unitOfWork as never, repository as never),
  };
}

describe('ProtocolQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded page for a team', async () => {
    harness.repository.listForTeam.mockResolvedValue([{ id: 'protocol-1' }]);
    harness.repository.countForTeam.mockResolvedValue(1);
    await expect(
      harness.service.listForTeam('team-1', { limit: 20, offset: 0 }),
    ).resolves.toEqual({
      items: [{ id: 'protocol-1' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('resolves a visible protocol or 404s', async () => {
    harness.repository.findVisible.mockResolvedValueOnce({ id: 'protocol-1' });
    await expect(
      harness.service.getDetail('team-1', 'protocol-1'),
    ).resolves.toMatchObject({ id: 'protocol-1' });
    harness.repository.findVisible.mockResolvedValueOnce(null);
    await expect(
      harness.service.getDetail('team-1', 'protocol-1'),
    ).rejects.toThrow(MeasurementProtocolNotFoundError);
  });
});
