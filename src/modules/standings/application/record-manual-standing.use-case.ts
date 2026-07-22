import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { scoreTally } from '../domain/standings-computation.policy';
import { StandingsProvenanceError } from '../errors/standings-provenance.error';
import { StandingsValidationError } from '../errors/standings-validation.error';
import { StandingRepository } from '../infrastructure/standing.repository';
import {
  buildManualStanding,
  buildManualTally,
  buildStandingAudit,
} from '../lib/standings.builders';
import { STANDINGS_MANUAL_ACTION } from '../model/standings.constants';
import { StandingEntrantKind } from '../model/standings.enums';
import type {
  CompetitionStanding,
  ManualStandingContent,
  RecordManualStandingCommand,
} from '../model/standings.types';
import { StandingsRuleService } from './standings-rule.service';
import { StandingsScopeService } from './standings-scope.service';

/**
 * Records a standings row that did NOT come from our own finalized matches — an
 * external organiser's table or a historical import (UN-506).
 *
 * Three things make it trustworthy: it is separately permissioned, it must carry
 * a reconciliation note explaining why it differs from the derived table, and it
 * is scored under a named rule version like every other row. The counts must be
 * internally consistent (wins + losses + ties = played); an inconsistent
 * override is rejected rather than stored as a contradiction.
 */
@Injectable()
export class RecordManualStandingUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly scopes: StandingsScopeService,
    private readonly rules: StandingsRuleService,
    private readonly standings: StandingRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: RecordManualStandingCommand,
  ): Promise<CompetitionStanding> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: RecordManualStandingCommand,
  ): Promise<CompetitionStanding> {
    const content = command.content;
    this.assertConsistent(content);
    const scope = await this.scopes.forCompetition(
      tx,
      teamId,
      content.competitionId,
    );
    await this.scopes.requireStage(tx, scope.competitionId, content.stageId);
    await this.scopes.requireOpponent(tx, teamId, content.opponentId);
    const rule = await this.rules.require(tx, teamId, content.ruleKey);
    const standing = await this.standings.upsert(
      tx,
      buildManualStanding(
        this.ids.generate(),
        scope,
        rule,
        content,
        scoreTally(buildManualTally(content), rule),
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildStandingAudit(STANDINGS_MANUAL_ACTION, actor.userId, standing),
    );
    return standing;
  }

  private assertConsistent(content: ManualStandingContent): void {
    if (content.reconciliationNote.length === 0) {
      throw new StandingsProvenanceError();
    }
    if (content.wins + content.losses + content.ties !== content.played) {
      throw new StandingsValidationError();
    }
    this.assertEntrantIdentity(content);
  }

  private assertEntrantIdentity(content: ManualStandingContent): void {
    const isOpponent = content.entrantKind === StandingEntrantKind.Opponent;
    if (isOpponent === (content.opponentId === null)) {
      throw new StandingsValidationError();
    }
  }
}
