import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canAcknowledgeClip } from '../domain/clip-visibility.policy';
import { ClipNotVisibleError } from '../errors/clip-not-visible.error';
import { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import { buildAcknowledgementAudit } from '../lib/analysis.builders';
import type { VideoClipView } from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';
import { ClipViewService } from './clip-view.service';

/**
 * Records that a visible player has seen the analysis addressed to them
 * (UN-505). Only a PUBLISHED clip the caller is actually tagged on can be
 * acknowledged — a coach-only clip is refused even to a tagged player — and the
 * instant is written once: a replay leaves the original acknowledgement intact
 * rather than moving it forward.
 */
@Injectable()
export class AcknowledgeVideoClipUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AnalysisLookupService,
    private readonly scopes: AnalysisScopeService,
    private readonly details: ClipDetailRepository,
    private readonly views: ClipViewService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
  ): Promise<VideoClipView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, clipId),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
  ): Promise<VideoClipView> {
    const clip = await this.lookup.requireClip(tx, teamId, clipId);
    const view = await this.views.assembleOne(tx, clip);
    const membershipId = await this.resolveMembership(tx, teamId, actor, view);
    await this.details.acknowledge(tx, clipId, membershipId, this.clock.now());
    await this.audit.record(
      tx,
      buildAcknowledgementAudit(actor.userId, clip, membershipId),
    );
    return this.views.assembleOne(tx, clip);
  }

  private async resolveMembership(
    tx: TransactionScope,
    teamId: string,
    actor: AuthUserIdentity,
    view: VideoClipView,
  ): Promise<string> {
    const own = await this.scopes.listViewerMemberships(
      tx,
      teamId,
      actor.userId,
    );
    const membershipId = own.find(candidate =>
      canAcknowledgeClip(view, candidate),
    );
    if (membershipId === undefined) {
      throw new ClipNotVisibleError();
    }
    return membershipId;
  }
}
