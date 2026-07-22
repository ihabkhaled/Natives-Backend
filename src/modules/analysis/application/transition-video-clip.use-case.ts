import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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
  canTransitionClip,
  isPublishTarget,
  targetStatusOf,
} from '../domain/clip.state-machine';
import { ClipInvalidTransitionError } from '../errors/clip-invalid-transition.error';
import { ClipVersionConflictError } from '../errors/clip-version-conflict.error';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import {
  buildClipAudit,
  buildClipPublishedEvent,
  buildClipStatusChange,
} from '../lib/analysis.builders';
import { VIDEO_CLIP_TRANSITIONED_ACTION } from '../model/analysis.constants';
import type {
  TransitionVideoClipCommand,
  VideoClip,
  VideoClipView,
} from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';
import { ClipViewService } from './clip-view.service';

/**
 * Moves a clip through its review workflow (UN-505). The state machine decides
 * what is legal, the optimistic record version decides who wins a race, and
 * publishing enqueues `analysis.clip.published` carrying only the audience SIZE
 * — never the note, never who was tagged. Publishing is the point a player can
 * first see the clip, which is why it is a distinct, audited transition rather
 * than a field update.
 */
@Injectable()
export class TransitionVideoClipUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AnalysisLookupService,
    private readonly clips: VideoClipRepository,
    private readonly views: ClipViewService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
    command: TransitionVideoClipCommand,
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
    command: TransitionVideoClipCommand,
  ): Promise<VideoClipView> {
    const existing = await this.lookup.requireClip(tx, teamId, clipId);
    const target = targetStatusOf(command.transition);
    if (!canTransitionClip(existing.status, target)) {
      throw new ClipInvalidTransitionError();
    }
    const changed = await this.clips.applyStatusChange(
      tx,
      buildClipStatusChange(
        existing,
        target,
        actor.userId,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: VideoClip | null,
  ): Promise<VideoClipView> {
    if (changed === null) {
      throw new ClipVersionConflictError();
    }
    const view = await this.views.assembleOne(tx, changed);
    await this.audit.record(
      tx,
      buildClipAudit(VIDEO_CLIP_TRANSITIONED_ACTION, actor.userId, changed),
    );
    if (isPublishTarget(changed.status)) {
      await this.events.enqueue(
        tx,
        buildClipPublishedEvent(
          changed,
          actor.userId,
          view.membershipIds.length,
        ),
      );
    }
    return view;
  }
}
