import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { PracticeTeamNotFoundError } from '../errors/practice-team-not-found.error';
import { SeasonScopeNotFoundError } from '../errors/season-scope-not-found.error';
import { VenueScopeNotFoundError } from '../errors/venue-scope-not-found.error';
import { PracticeScopeRepository } from '../infrastructure/practice-scope.repository';

/**
 * Validates the team/season/venue scope a practice write targets before any row
 * is written: the team must be active, and any referenced season/venue must
 * belong to that team. A missing or cross-team reference resolves to a clean
 * not-found rather than a raw foreign-key violation. Null references are skipped
 * (null-not-zero): an absent season/venue is simply not checked.
 */
@Injectable()
export class ScopeValidationService {
  constructor(private readonly scopes: PracticeScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    venueId: string | null,
  ): Promise<void> {
    await this.requireTeam(scope, teamId);
    await this.validateReferences(scope, teamId, seasonId, venueId);
  }

  async validateReferences(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    venueId: string | null,
  ): Promise<void> {
    await this.requireSeason(scope, teamId, seasonId);
    await this.requireVenue(scope, teamId, venueId);
  }

  private async requireTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<void> {
    if (!(await this.scopes.activeTeamExists(scope, teamId))) {
      throw new PracticeTeamNotFoundError();
    }
  }

  private async requireSeason(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (
      seasonId !== null &&
      !(await this.scopes.seasonExistsInTeam(scope, teamId, seasonId))
    ) {
      throw new SeasonScopeNotFoundError();
    }
  }

  private async requireVenue(
    scope: TransactionScope,
    teamId: string,
    venueId: string | null,
  ): Promise<void> {
    if (
      venueId !== null &&
      !(await this.scopes.venueExistsInTeam(scope, teamId, venueId))
    ) {
      throw new VenueScopeNotFoundError();
    }
  }
}
