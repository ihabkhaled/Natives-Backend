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

import { VideoSourceRepository } from '../infrastructure/video-source.repository';
import {
  buildNewVideoSource,
  buildSourceRegisteredAudit,
} from '../lib/analysis.builders';
import type {
  RegisterVideoSourceCommand,
  VideoSource,
} from '../model/analysis.types';
import { AnalysisScopeService } from './analysis-scope.service';

/**
 * Registers one recording of a match (UN-505). The team/season scope is resolved
 * server-side from the referenced match — never taken from the body — and the
 * whole write commits atomically with its audit entry. Only the provider and an
 * opaque object reference are stored; the application never receives, copies, or
 * re-hosts the video itself.
 */
@Injectable()
export class RegisterVideoSourceUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly scopes: AnalysisScopeService,
    private readonly sources: VideoSourceRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: RegisterVideoSourceCommand,
  ): Promise<VideoSource> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: RegisterVideoSourceCommand,
  ): Promise<VideoSource> {
    const scope = await this.scopes.forMatch(
      tx,
      teamId,
      command.content.matchId,
    );
    const source = await this.sources.insert(
      tx,
      buildNewVideoSource(
        this.ids.generate(),
        scope.teamId,
        scope.seasonId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildSourceRegisteredAudit(actor.userId, source),
    );
    return source;
  }
}
