import { describe, expect, it, vi } from 'vitest';

import { CompetitionNotFoundError } from '../errors/competition-not-found.error';
import { CompetitionLookupService } from './competition-lookup.service';

const TX = {} as never;

describe('CompetitionLookupService', () => {
  it('returns the resolved competition', async () => {
    const repository = {
      findForWrite: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
    };
    const service = new CompetitionLookupService(repository as never);
    const competition = await service.require(TX, 'team-1', 'comp-1');
    expect(competition.competitionId).toBe('comp-1');
  });

  it('404s a missing or cross-team competition', async () => {
    const repository = { findForWrite: vi.fn().mockResolvedValue(null) };
    const service = new CompetitionLookupService(repository as never);
    await expect(
      service.require(TX, 'team-1', 'comp-1'),
    ).rejects.toBeInstanceOf(CompetitionNotFoundError);
  });
});
