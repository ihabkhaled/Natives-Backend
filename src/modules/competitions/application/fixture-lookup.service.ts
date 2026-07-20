import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { FixtureNotFoundError } from '../errors/fixture-not-found.error';
import { FixtureRepository } from '../infrastructure/fixture.repository';
import type { Fixture } from '../model/competitions.types';

/**
 * Resolves a team-owned fixture within a competition for a write, translating a
 * miss into a 404 that hides existence. A cross-team or cross-competition id
 * resolves to not-found, never a leak.
 */
@Injectable()
export class FixtureLookupService {
  constructor(private readonly repository: FixtureRepository) {}

  async require(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
    fixtureId: string,
  ): Promise<Fixture> {
    const fixture = await this.repository.findForWrite(
      scope,
      teamId,
      competitionId,
      fixtureId,
    );
    if (fixture === null) {
      throw new FixtureNotFoundError();
    }
    return fixture;
  }
}
