import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import type { ListTeamsResult, PageRequest, Team } from '../model/teams.types';

/**
 * Read side for teams: fetch one team by id, or list teams in a bounded,
 * deterministically ordered page. Reads run in a transaction scope like every
 * other persistence access; team.read is broadly granted, so no ownership filter.
 */
@Injectable()
export class TeamQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly teams: TeamRepository,
  ) {}

  getTeam(teamId: string): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.loadTeam(scope, teamId),
    );
  }

  listTeams(page: PageRequest): Promise<ListTeamsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.teams.list(scope, page),
    );
  }

  private async loadTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<Team> {
    const team = await this.teams.findById(scope, teamId);
    if (team === null) {
      throw new TeamNotFoundError();
    }
    return team;
  }
}
