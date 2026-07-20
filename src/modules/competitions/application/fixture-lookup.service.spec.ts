import { describe, expect, it, vi } from 'vitest';

import { FixtureNotFoundError } from '../errors/fixture-not-found.error';
import { FixtureLookupService } from './fixture-lookup.service';

const TX = {} as never;

describe('FixtureLookupService', () => {
  it('returns the resolved fixture', async () => {
    const repository = {
      findForWrite: vi.fn().mockResolvedValue({ fixtureId: 'fixture-1' }),
    };
    const service = new FixtureLookupService(repository as never);
    const fixture = await service.require(TX, 'team-1', 'comp-1', 'fixture-1');
    expect(fixture.fixtureId).toBe('fixture-1');
  });

  it('404s a missing or cross-scope fixture', async () => {
    const repository = { findForWrite: vi.fn().mockResolvedValue(null) };
    const service = new FixtureLookupService(repository as never);
    await expect(
      service.require(TX, 'team-1', 'comp-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(FixtureNotFoundError);
  });
});
