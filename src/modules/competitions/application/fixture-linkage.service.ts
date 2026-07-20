import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { OpponentNotFoundError } from '../errors/opponent-not-found.error';
import { OpponentRepository } from '../infrastructure/opponent.repository';
import { StageRepository } from '../infrastructure/stage.repository';
import type { FixtureContent } from '../model/competitions.types';

/**
 * Validates that a fixture's opponent, stage, and round belong to the same team
 * and competition before it is booked. A missing opponent is a 404 that hides
 * existence; a stage/round that does not belong to the competition resolves to the
 * scope 404. A round without its parent stage is rejected as an invalid scope.
 */
@Injectable()
export class FixtureLinkageService {
  constructor(
    private readonly opponents: OpponentRepository,
    private readonly stages: StageRepository,
  ) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
    content: FixtureContent,
  ): Promise<void> {
    await this.requireOpponent(scope, teamId, content.opponentId);
    await this.requireStage(scope, competitionId, content.stageId);
    await this.requireRound(scope, competitionId, content);
  }

  private async requireOpponent(
    scope: TransactionScope,
    teamId: string,
    opponentId: string,
  ): Promise<void> {
    if (!(await this.opponents.activeInTeam(scope, teamId, opponentId))) {
      throw new OpponentNotFoundError();
    }
  }

  private async requireStage(
    scope: TransactionScope,
    competitionId: string,
    stageId: string | null,
  ): Promise<void> {
    if (stageId === null) {
      return;
    }
    if (
      !(await this.stages.stageInCompetition(scope, competitionId, stageId))
    ) {
      throw new CompetitionScopeNotFoundError();
    }
  }

  private async requireRound(
    scope: TransactionScope,
    competitionId: string,
    content: FixtureContent,
  ): Promise<void> {
    if (content.roundId === null) {
      return;
    }
    if (!(await this.roundBelongs(scope, competitionId, content))) {
      throw new CompetitionScopeNotFoundError();
    }
  }

  private async roundBelongs(
    scope: TransactionScope,
    competitionId: string,
    content: FixtureContent,
  ): Promise<boolean> {
    if (content.stageId === null || content.roundId === null) {
      return false;
    }
    return this.stages.roundInStage(
      scope,
      competitionId,
      content.stageId,
      content.roundId,
    );
  }
}
