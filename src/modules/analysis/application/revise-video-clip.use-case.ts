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

import { isFinalizedClip } from '../domain/clip.state-machine';
import { evaluateClipWindow } from '../domain/clip-timestamp.policy';
import { ClipImmutableError } from '../errors/clip-immutable.error';
import { ClipTimestampError } from '../errors/clip-timestamp.error';
import { ClipVersionConflictError } from '../errors/clip-version-conflict.error';
import { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import {
  buildClipAudit,
  buildClipRevisedEvent,
  buildClipStatusChange,
  buildSuccessorClip,
} from '../lib/analysis.builders';
import { VIDEO_CLIP_REVISED_ACTION } from '../model/analysis.constants';
import { ClipStatus } from '../model/analysis.enums';
import type {
  ReviseVideoClipCommand,
  VideoClip,
  VideoClipView,
} from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';
import { ClipViewService } from './clip-view.service';

/**
 * Supersedes a PUBLISHED clip with a corrected successor (UN-505). A published
 * clip is the record players were shown, so it is never edited in place: the
 * original moves to `revised` under an optimistic version guard and a new row
 * carries the next revision number and points back at it. Reading the history of
 * what a squad was told therefore stays possible forever.
 */
@Injectable()
export class ReviseVideoClipUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: AnalysisLookupService,
    private readonly scopes: AnalysisScopeService,
    private readonly clips: VideoClipRepository,
    private readonly details: ClipDetailRepository,
    private readonly views: ClipViewService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
    command: ReviseVideoClipCommand,
  ): Promise<VideoClipView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, clipId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
    command: ReviseVideoClipCommand,
  ): Promise<VideoClipView> {
    const existing = await this.lookup.requireClip(tx, teamId, clipId);
    if (!isFinalizedClip(existing.status)) {
      throw new ClipImmutableError();
    }
    await this.assertWindow(tx, teamId, existing, command);
    const superseded = await this.clips.applyStatusChange(
      tx,
      buildClipStatusChange(
        existing,
        ClipStatus.Revised,
        actor.userId,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.createSuccessor(tx, actor, teamId, superseded, command);
  }

  private async assertWindow(
    tx: TransactionScope,
    teamId: string,
    existing: VideoClip,
    command: ReviseVideoClipCommand,
  ): Promise<void> {
    const source = await this.lookup.requireSource(
      tx,
      teamId,
      existing.sourceId,
    );
    const verdict = evaluateClipWindow(
      {
        startSecond: command.content.startSecond,
        endSecond: command.content.endSecond,
      },
      source.durationSeconds,
    );
    if (!verdict.valid) {
      throw new ClipTimestampError();
    }
  }

  private async createSuccessor(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    superseded: VideoClip | null,
    command: ReviseVideoClipCommand,
  ): Promise<VideoClipView> {
    if (superseded === null) {
      throw new ClipVersionConflictError();
    }
    const now = this.clock.now();
    const successor = await this.clips.insert(
      tx,
      buildSuccessorClip(
        this.ids.generate(),
        superseded,
        command.content,
        actor.userId,
        now,
      ),
    );
    await this.copyDetails(tx, teamId, successor.clipId, command, now);
    await this.audit.record(
      tx,
      buildClipAudit(VIDEO_CLIP_REVISED_ACTION, actor.userId, successor),
    );
    await this.events.enqueue(
      tx,
      buildClipRevisedEvent(superseded, successor.clipId, actor.userId),
    );
    return this.views.assembleOne(tx, successor);
  }

  private async copyDetails(
    tx: TransactionScope,
    teamId: string,
    clipId: string,
    command: ReviseVideoClipCommand,
    now: Date,
  ): Promise<void> {
    const memberships = await this.scopes.filterTeamMemberships(
      tx,
      teamId,
      command.content.membershipIds,
    );
    await this.details.replacePlayers(tx, clipId, memberships, now);
    await this.details.replaceTags(tx, clipId, command.content.tags, now);
  }
}
