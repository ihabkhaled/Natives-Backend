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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  canReopen,
  nextRevision,
  toCurrentScore,
} from '../domain/match-correction.policy';
import { MatchReopenNotAllowedError } from '../errors/match-reopen-not-allowed.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import { MatchRepository } from '../infrastructure/match.repository';
import { MatchRevisionRepository } from '../infrastructure/match-revision.repository';
import {
  buildMatchAudit,
  buildMatchReopenedEvent,
  buildMatchReopening,
  buildNewMatchRevision,
} from '../lib/matches.builders';
import { MATCH_REOPENED_ACTION } from '../model/matches.constants';
import { MatchRevisionAction } from '../model/matches.enums';
import type { Match, ReopenMatchCommand } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Reopens a FINALIZED match for correction (match.correct) — the only lawful way
 * a published score can ever change.
 *
 * Nothing is edited in place: the reopening bumps the match revision (the single
 * update the immutability trigger accepts on a finalized row), records a
 * mandatory reason, appends an immutable revision row carrying the score as
 * published, and publishes `match.reopened`. The match returns to LIVE so the
 * correction is made by APPENDING to the same authoritative stream, and
 * re-finalizing records the delta as a `corrected` revision.
 */
@Injectable()
export class ReopenMatchUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly matches: MatchRepository,
    private readonly revisions: MatchRevisionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: ReopenMatchCommand,
  ): Promise<Match> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, matchId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: ReopenMatchCommand,
  ): Promise<Match> {
    const existing = await this.lookup.require(tx, teamId, matchId);
    if (!canReopen(existing.status)) {
      throw new MatchReopenNotAllowedError();
    }
    const reopened = await this.matches.applyReopening(
      tx,
      buildMatchReopening(
        existing,
        command.expectedRecordVersion,
        nextRevision(existing.revision),
        command.reason,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, existing, reopened, command);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    reopened: Match | null,
    command: ReopenMatchCommand,
  ): Promise<Match> {
    if (reopened === null) {
      throw new MatchVersionConflictError();
    }
    await this.record(tx, actor, existing, reopened, command);
    await this.audit.record(
      tx,
      buildMatchAudit(MATCH_REOPENED_ACTION, actor.userId, reopened),
    );
    await this.events.enqueue(
      tx,
      buildMatchReopenedEvent(reopened, toCurrentScore(existing), actor.userId),
    );
    return reopened;
  }

  private async record(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    reopened: Match,
    command: ReopenMatchCommand,
  ): Promise<void> {
    await this.revisions.append(
      tx,
      buildNewMatchRevision(
        this.idGenerator.generate(),
        await this.revisions.nextSequence(tx, reopened.matchId),
        reopened,
        MatchRevisionAction.Reopened,
        command.reason,
        existing.status,
        toCurrentScore(existing),
        actor.userId,
        this.clock.now(),
      ),
    );
  }
}
