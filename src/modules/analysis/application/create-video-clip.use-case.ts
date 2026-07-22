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

import { evaluateClipWindow } from '../domain/clip-timestamp.policy';
import { ClipTimestampError } from '../errors/clip-timestamp.error';
import { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import { buildClipAudit, buildNewVideoClip } from '../lib/analysis.builders';
import { VIDEO_CLIP_CREATED_ACTION } from '../model/analysis.constants';
import type {
  CreateVideoClipCommand,
  VideoClipContent,
  VideoClipView,
  VideoSource,
} from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';
import { ClipViewService } from './clip-view.service';

/**
 * Creates a DRAFT analysis clip on a registered source (UN-505). The timestamp
 * window is checked against the source duration when one is known — an unknown
 * duration removes the upper bound instead of rejecting the clip — and the
 * tagged memberships are filtered to real members of the team, so a clip can
 * never be addressed to somebody else's player. The clip, its players, its tags
 * and the audit entry commit together.
 */
@Injectable()
export class CreateVideoClipUseCase {
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
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateVideoClipCommand,
  ): Promise<VideoClipView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateVideoClipCommand,
  ): Promise<VideoClipView> {
    const source = await this.lookup.requireSource(
      tx,
      teamId,
      command.content.sourceId,
    );
    this.assertWindow(source, command.content);
    const clip = await this.clips.insert(
      tx,
      buildNewVideoClip(
        this.ids.generate(),
        source,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.writeDetails(tx, teamId, clip.clipId, command.content);
    await this.audit.record(
      tx,
      buildClipAudit(VIDEO_CLIP_CREATED_ACTION, actor.userId, clip),
    );
    return this.views.assembleOne(tx, clip);
  }

  private assertWindow(source: VideoSource, content: VideoClipContent): void {
    const verdict = evaluateClipWindow(
      { startSecond: content.startSecond, endSecond: content.endSecond },
      source.durationSeconds,
    );
    if (!verdict.valid) {
      throw new ClipTimestampError();
    }
  }

  private async writeDetails(
    tx: TransactionScope,
    teamId: string,
    clipId: string,
    content: VideoClipContent,
  ): Promise<void> {
    const memberships = await this.scopes.filterTeamMemberships(
      tx,
      teamId,
      content.membershipIds,
    );
    const now = this.clock.now();
    await this.details.replacePlayers(tx, clipId, memberships, now);
    await this.details.replaceTags(tx, clipId, content.tags, now);
  }
}
